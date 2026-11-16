-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 9: melhorias de escala da ADR-0001 (M1, M2, M3, M12, M14, M16).
-- Rodar DEPOIS das partes 1–8. pg_cron: habilitar em Database → Extensions
-- antes (sem ele, os jobs não são agendados e a parte avisa com NOTICE).

-- ─── M2: índices das consultas quentes ──────────────────────────────────────
create index if not exists corre_resgates_usuario_gerado_idx
  on public.resgates (usuario_id, gerado_em desc);
create index if not exists corre_resgates_oferta_status_idx
  on public.resgates (oferta_id, status);
create index if not exists corre_resgates_validados_idx
  on public.resgates (validado_em) where status = 'validado';
create index if not exists corre_tentativas_parceiro_idx
  on public.tentativas_validacao (parceiro_id, criado_em desc);
create index if not exists corre_tokens_expira_idx
  on public.tokens_carteirinha (expira_em);

-- ─── M1: expirar códigos e limpar tokens (pg_cron) ──────────────────────────
-- Sem isso, 'gerado' vencido ocupa o espaço de ~1M códigos (G4) e token órfão
-- acumula para sempre (G1).
create or replace function public.corre_expirar_resgates()
returns integer
language sql security definer set search_path = public
as $$
  with x as (
    update public.resgates set status = 'expirado'
     where status = 'gerado' and gerado_em < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::int from x;
$$;

create or replace function public.corre_limpar_tokens_carteirinha()
returns integer
language sql security definer set search_path = public
as $$
  with x as (
    delete from public.tokens_carteirinha
     where expira_em < now() - interval '5 minutes'
    returning 1
  )
  select count(*)::int from x;
$$;

revoke all on function public.corre_expirar_resgates() from public, anon, authenticated;
revoke all on function public.corre_limpar_tokens_carteirinha() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('corre-expirar-resgates', 'corre-limpar-tokens');
    perform cron.schedule('corre-expirar-resgates', '* * * * *',
                          'select public.corre_expirar_resgates()');
    perform cron.schedule('corre-limpar-tokens', '*/10 * * * *',
                          'select public.corre_limpar_tokens_carteirinha()');
  else
    raise notice 'pg_cron não habilitado: jobs não agendados. Habilite e rode a parte 9 de novo.';
  end if;
end $$;

-- ─── M3: lock condicional na geração de código ──────────────────────────────
create or replace function public.corre_resgates_antes_inserir()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  o record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select ofe.parceiro_id, ofe.status::text as status, ofe.tipo::text as tipo,
         ofe.exclusivo_associados, ofe.exclusivo_premium,
         ofe.limite_por_usuario, ofe.limite_total,
         ofe.validade_inicio, ofe.validade_fim,
         ofe.valor_desconto, ofe.preco_de, ofe.preco_por,
         par.status::text as parceiro_status
    into o
    from public.ofertas ofe join public.parceiros par on par.id = ofe.parceiro_id
   where ofe.id = new.oferta_id;

  if not found or o.status <> 'ativa' or o.parceiro_status <> 'ativo' then
    raise exception 'oferta indisponivel' using errcode = 'P0001';
  end if;
  if o.validade_inicio is not null and o.validade_inicio > v_hoje then
    raise exception 'oferta nao comecou' using errcode = 'P0001';
  end if;
  if o.validade_fim is not null and o.validade_fim < v_hoje then
    raise exception 'oferta vencida' using errcode = 'P0001';
  end if;
  if o.exclusivo_associados and not exists (
    select 1 from public.associados
     where usuario_id = new.usuario_id and status = 'ativo'
  ) then
    -- PENDENTE: carência do inadimplente (sugestão 7 dias) precisa de
    -- associados.inadimplente_desde.
    raise exception 'oferta exclusiva de associado' using errcode = 'P0001';
  end if;
  if o.exclusivo_premium and not exists (
    select 1 from public.usuarios where id = new.usuario_id and plano = 'premium'
  ) then
    raise exception 'oferta premium' using errcode = 'P0001';
  end if;

  -- Lock por usuário sempre (rate limit e limite por usuário certos) e por
  -- oferta só quando ela tem limite total (ADR-0001 G2/M3). Ordem fixa:
  -- usuário → oferta, sem deadlock.
  perform pg_advisory_xact_lock(hashtext('resgate-usuario:' || new.usuario_id::text));
  if o.limite_total is not null then
    perform pg_advisory_xact_lock(hashtext(new.oferta_id::text));
  end if;

  if not public.corre_eh_backend() and (
    select count(*) from public.resgates
     where usuario_id = new.usuario_id
       and gerado_em > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'muitos códigos em pouco tempo' using errcode = 'P0001';
  end if;

  update public.resgates set status = 'expirado'
   where usuario_id = new.usuario_id and oferta_id = new.oferta_id
     and status = 'gerado' and gerado_em < now() - interval '15 minutes';

  -- Vencido sem uso não gasta cota (abertos daqui pra frente são todos < 15 min).
  if o.limite_por_usuario is not null and (
    select count(*) from public.resgates
     where oferta_id = new.oferta_id and usuario_id = new.usuario_id
       and (status = 'validado'
            or (status = 'gerado' and gerado_em >= now() - interval '15 minutes'))
  ) >= o.limite_por_usuario then
    raise exception 'limite por usuario atingido' using errcode = 'P0001';
  end if;
  if o.limite_total is not null and (
    select count(*) from public.resgates
     where oferta_id = new.oferta_id
       and (status = 'validado'
            or (status = 'gerado' and gerado_em >= now() - interval '15 minutes'))
  ) >= o.limite_total then
    raise exception 'oferta esgotada' using errcode = 'P0001';
  end if;

  new.parceiro_id       := o.parceiro_id;  -- nunca o que o client mandou
  new.valor_economizado := case
    when o.preco_de is not null and o.preco_por is not null
      then greatest(o.preco_de - o.preco_por, 0)
    when o.tipo = 'desconto_fixo' then o.valor_desconto
    else null  -- percentual/cashback/brinde: depende do valor da compra
  end;
  new.codigo          := public.corre_gerar_codigo();
  new.status          := 'gerado';
  new.gerado_em       := now();
  new.validado_em     := null;
  new.validado_por    := null;
  new.plano_parceiro  := null;
  new.tarifa_aplicada := null;
  return new;
end;
$$;

-- ─── M16: limite de validação também por parceiro ───────────────────────────
create or replace function public.validar_resgate(_codigo text, _parceiro_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cod text := upper(trim(_codigo));
  v_erros_min int;
  v_erros_hora int;
  v_parceiro_min int;
  v_parceiro_hora int;
  v_id text;
begin
  if v_uid is null or not public.corre_parceiro_de(_parceiro_id) then
    raise exception 'validar_resgate: sem permissão' using errcode = '42501';
  end if;

  -- Bloqueio progressivo: 5 erros/min ou 20/hora. Tentativa bloqueada também
  -- conta, então insistir estende o bloqueio sozinho.
  select count(*) filter (where criado_em > now() - interval '1 minute'),
         count(*)
    into v_erros_min, v_erros_hora
    from public.tentativas_validacao
   where usuario_id = v_uid and resultado <> 'ok'
     and criado_em > now() - interval '1 hour';

  -- Limite também por parceiro (ADR-0001 L5/M16): N logins não multiplicam tentativas.
  select count(*) filter (where criado_em > now() - interval '1 minute'),
         count(*)
    into v_parceiro_min, v_parceiro_hora
    from public.tentativas_validacao
   where parceiro_id = _parceiro_id and resultado <> 'ok'
     and criado_em > now() - interval '1 hour';

  if v_erros_min >= 5 or v_erros_hora >= 20
     or v_parceiro_min >= 10 or v_parceiro_hora >= 40 then
    insert into public.tentativas_validacao
      (parceiro_id, usuario_id, codigo_digitado, resultado)
    values (_parceiro_id, v_uid, v_cod, 'bloqueado');
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
  end if;

  -- Código sozinho não basta: precisa ser deste parceiro, oferta ativa,
  -- aberto e dentro dos 15 min.
  update public.resgates r set status = 'validado'
    from public.ofertas o
   where r.codigo = v_cod
     and r.parceiro_id = _parceiro_id
     and r.status = 'gerado'
     and r.gerado_em >= now() - interval '15 minutes'
     and o.id = r.oferta_id and o.status = 'ativa'
  returning r.id::text into v_id;

  insert into public.tentativas_validacao
    (parceiro_id, usuario_id, codigo_digitado, resgate_id, resultado)
  values (_parceiro_id, v_uid, v_cod, v_id,
          case when v_id is null then 'codigo_invalido' else 'ok' end);

  if v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  return jsonb_build_object('ok', true, 'resgate_id', v_id);
end;
$$;

revoke all on function public.validar_resgate(text, uuid) from public, anon;
grant execute on function public.validar_resgate(text, uuid) to authenticated;

-- ─── M16: um pedido de filiação pendente por (usuário, associação) ──────────
-- Fecha duplicados antigos (mantém o mais antigo) antes do índice único.
with dup as (
  select id, row_number() over (partition by usuario_id, associacao_id
                                order by criado_em, id) as n
    from public.solicitacoes_filiacao
   where status = 'pendente'
)
update public.solicitacoes_filiacao s
   set status = 'cancelada'
  from dup
 where s.id = dup.id and dup.n > 1;

create unique index if not exists corre_filiacao_uma_pendente
  on public.solicitacoes_filiacao (usuario_id, associacao_id)
  where status = 'pendente';

-- ─── M14: número da carteirinha por contador da associação ──────────────────
create table if not exists public.carteirinha_sequencias (
  associacao_id uuid primary key,
  ultimo bigint not null check (ultimo >= 0)
);
alter table public.carteirinha_sequencias enable row level security;
revoke all on public.carteirinha_sequencias from anon, authenticated;

insert into public.carteirinha_sequencias (associacao_id, ultimo)
select associacao_id,
       coalesce(max(nullif(regexp_replace(numero_carteirinha, '\D', '', 'g'), '')::bigint), 0)
  from public.associados
 group by associacao_id
on conflict (associacao_id) do update
  set ultimo = greatest(public.carteirinha_sequencias.ultimo, excluded.ultimo);

-- O painel web também cria associados com número próprio: o contador
-- acompanha qualquer insert, então o app nunca repete número.
create or replace function public.corre_carteirinha_sincronizar()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v bigint := nullif(regexp_replace(coalesce(new.numero_carteirinha, ''), '\D', '', 'g'), '')::bigint;
begin
  if v is not null then
    insert into public.carteirinha_sequencias as c (associacao_id, ultimo)
    values (new.associacao_id, v)
    on conflict (associacao_id) do update set ultimo = greatest(c.ultimo, excluded.ultimo);
  end if;
  return new;
end;
$$;

drop trigger if exists corre_carteirinha_sincronizar on public.associados;
create trigger corre_carteirinha_sincronizar
  after insert on public.associados
  for each row execute function public.corre_carteirinha_sincronizar();

create or replace function public.aprovar_solicitacao_filiacao(
  _solicitacao_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s record;
  v_seq bigint;
begin
  if auth.uid() is null then
    raise exception 'filiação: autenticação necessária' using errcode = '42501';
  end if;

  select id, usuario_id, associacao_id, status::text as status,
         nome, cpf, telefone, cidade, uf, tipo_veiculo, placa
    into s
    from public.solicitacoes_filiacao
   where id = _solicitacao_id
   for update;

  if not found then
    raise exception 'filiação: pedido não encontrado' using errcode = 'P0001';
  end if;
  if not public.corre_admin_da_associacao(s.associacao_id) then
    raise exception 'filiação: sem permissão para esta associação'
      using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'filiação: pedido já analisado' using errcode = 'P0001';
  end if;

  -- Serializa pedidos simultâneos da mesma pessoa para a mesma associação.
  perform pg_advisory_xact_lock(
    hashtext(s.usuario_id::text || ':' || s.associacao_id::text)
  );

  -- Vínculo já existe (pedido duplicado ou criado pelo painel web): fecha este
  -- pedido e os irmãos pendentes em vez de travar a fila do admin.
  -- Não reativa vínculo cancelado/inadimplente: isso segue pelo painel web.
  if exists (
    select 1 from public.associados
     where usuario_id = s.usuario_id and associacao_id = s.associacao_id
  ) then
    update public.solicitacoes_filiacao
       set status = 'aprovada', observacao = null
     where usuario_id = s.usuario_id
       and associacao_id = s.associacao_id
       and status::text = 'pendente';
    return;
  end if;

  insert into public.usuarios
    (id, nome, cpf, telefone, cidade, uf, tipo_veiculo, placa)
  values
    (s.usuario_id, s.nome, s.cpf, s.telefone, s.cidade, s.uf,
     s.tipo_veiculo, s.placa)
  on conflict (id) do update set
    nome = excluded.nome,
    cpf = excluded.cpf,
    telefone = excluded.telefone,
    cidade = excluded.cidade,
    uf = excluded.uf,
    tipo_veiculo = excluded.tipo_veiculo,
    placa = excluded.placa;

  -- Próximo número pelo contador da associação (ADR-0001 G7/M14): upsert com
  -- trava de linha, sem varrer associados.
  insert into public.carteirinha_sequencias as c (associacao_id, ultimo)
  values (s.associacao_id, 1)
  on conflict (associacao_id) do update set ultimo = c.ultimo + 1
  returning ultimo into v_seq;

  insert into public.associados
    (usuario_id, associacao_id, status, numero_carteirinha)
  values
    (s.usuario_id, s.associacao_id, 'ativo', lpad(v_seq::text, 6, '0'));

  if not exists (
    select 1 from public.papeis_usuario
     where usuario_id = s.usuario_id
       and papel::text = 'entregador'
       and associacao_id = s.associacao_id
  ) then
    insert into public.papeis_usuario (usuario_id, papel, associacao_id)
    values (s.usuario_id, 'entregador', s.associacao_id);
  end if;

  -- Fecha também pedidos duplicados da mesma pessoa para a mesma associação.
  update public.solicitacoes_filiacao
     set status = 'aprovada', observacao = null
   where usuario_id = s.usuario_id
     and associacao_id = s.associacao_id
     and status::text = 'pendente';
end;
$$;

revoke all on function public.aprovar_solicitacao_filiacao(uuid) from public, anon;
grant execute on function public.aprovar_solicitacao_filiacao(uuid) to authenticated;

-- ─── M12: RLS sem reavaliar auth.uid()/papel por linha ──────────────────────
-- (select ...) vira initPlan: avaliado uma vez por consulta (prática do Supabase).
drop policy if exists corre_trava_resgates_select on public.resgates;
create policy corre_trava_resgates_select on public.resgates
  as restrictive for select to authenticated
  using (usuario_id = (select auth.uid())
         or public.corre_parceiro_de(parceiro_id)
         or public.corre_admin_do_usuario(usuario_id));

drop policy if exists corre_trava_resgates_update on public.resgates;
create policy corre_trava_resgates_update on public.resgates
  as restrictive for update to authenticated
  using (usuario_id = (select auth.uid()) or (select public.corre_tem_papel('admin_trakto')))
  with check (usuario_id = (select auth.uid()) or (select public.corre_tem_papel('admin_trakto')));

drop policy if exists corre_trava_resgates_insert on public.resgates;
create policy corre_trava_resgates_insert on public.resgates
  as restrictive for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists corre_trava_usuarios_proprio on public.usuarios;
create policy corre_trava_usuarios_proprio on public.usuarios
  as restrictive for all to authenticated
  using (id = (select auth.uid()) or public.corre_admin_do_usuario(id))
  with check (id = (select auth.uid()) or (select public.corre_tem_papel('admin_trakto')));

drop policy if exists corre_trava_associados on public.associados;
create policy corre_trava_associados on public.associados
  as restrictive for all to authenticated
  using (usuario_id = (select auth.uid())
         or public.corre_admin_da_associacao(associacao_id))
  with check (public.corre_admin_da_associacao(associacao_id));

drop policy if exists corre_trava_filiacao_leitura on public.solicitacoes_filiacao;
create policy corre_trava_filiacao_leitura on public.solicitacoes_filiacao
  as restrictive for select to authenticated
  using (usuario_id = (select auth.uid())
         or public.corre_admin_da_associacao(associacao_id));

drop policy if exists corre_trava_filiacao_insert on public.solicitacoes_filiacao;
create policy corre_trava_filiacao_insert on public.solicitacoes_filiacao
  as restrictive for insert to authenticated
  with check (usuario_id = (select auth.uid()) and status::text = 'pendente');
