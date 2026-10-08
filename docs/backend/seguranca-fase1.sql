-- =============================================================================
-- CORRE — Fase 1: travas de segurança do banco
-- =============================================================================
-- Para: time do backend (projeto goias-delivery-link / Supabase).
-- Como aplicar: virar migration no repo do backend. Rodar PRIMEIRO em staging,
-- depois `node scripts/auditoria-seguranca.mjs` contra staging, e só então prod.
--
-- Estratégia: políticas RESTRICTIVE + triggers. Políticas restritivas são
-- combinadas com AND sobre as permissivas que já existem — então estas travas
-- valem sem precisar conhecer/derrubar as políticas atuais.
--
-- Premissas (conferidas via API em 06/10/2026):
--   papeis_usuario(usuario_id, papel, associacao_id, parceiro_id)
--   resgates(usuario_id, parceiro_id, oferta_id, codigo, gerado_em, status,
--            validado_em, valor_economizado, validado_por), status enum status_resgate
--   parceiros(id, plano, status)  ofertas(id, status)
--   usuarios(id, plano, status)  associados(usuario_id, associacao_id, status)
--   solicitacoes_filiacao(usuario_id, associacao_id, status)
--   parceiros/ofertas sem associacao_id (catálogo compartilhado)
-- =============================================================================


-- ─── 0. AUDITORIA (só leitura — rode antes e guarde o resultado) ─────────────

-- Tabelas do schema public SEM RLS (deve voltar vazio):
-- select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- Todas as políticas atuais:
-- select tablename, policyname, permissive, roles, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, cmd;

-- Corpo das funções sensíveis (conferir checklist da seção 7):
-- select pg_get_functiondef(p.oid) from pg_proc p
--  where p.proname in ('gerar_token_carteirinha', 'eh_admin_associacao',
--                      'resgates_preparar_insert');

-- Funções SECURITY DEFINER sem search_path fixo (deve voltar vazio):
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prosecdef
--    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
--                    where c like 'search_path=%');


begin;

-- ─── 1. Helpers ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER: lê papeis_usuario sem cair na RLS (evita recursão infinita
-- quando usados nas políticas da própria papeis_usuario).

create or replace function public.corre_tem_papel(_papel text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.papeis_usuario
     where usuario_id = auth.uid() and papel::text = _papel
  );
$$;

create or replace function public.corre_admin_da_associacao(_associacao_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.corre_tem_papel('admin_trakto') or exists (
    select 1 from public.papeis_usuario
     where usuario_id = auth.uid()
       and papel::text = 'admin_associacao'
       and associacao_id = _associacao_id
  );
$$;

-- Admin vê o entregador só se ele for da associação que administra.
create or replace function public.corre_admin_do_usuario(_usuario_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.corre_tem_papel('admin_trakto') or exists (
    select 1 from public.associados a
     where a.usuario_id = _usuario_id
       and public.corre_admin_da_associacao(a.associacao_id)
  );
$$;

-- Usuário é do parceiro (papeis_usuario.papel = 'parceiro' + parceiro_id).
create or replace function public.corre_parceiro_de(_parceiro_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.papeis_usuario
     where usuario_id = auth.uid()
       and papel::text = 'parceiro'
       and parceiro_id = _parceiro_id
  );
$$;

-- Bypass só para backend: Edge Function (service_role) e SQL direto do dono.
-- session_user, não current_user: dentro de SECURITY DEFINER current_user é
-- sempre o dono da função (postgres) e liberaria todo mundo.
create or replace function public.corre_eh_backend()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

revoke all on function public.corre_tem_papel(text) from public, anon;
revoke all on function public.corre_admin_da_associacao(uuid) from public, anon;
revoke all on function public.corre_admin_do_usuario(uuid) from public, anon;
revoke all on function public.corre_parceiro_de(uuid) from public, anon;
grant execute on function public.corre_parceiro_de(uuid) to authenticated;
grant execute on function public.corre_tem_papel(text) to authenticated;
grant execute on function public.corre_admin_da_associacao(uuid) to authenticated;
grant execute on function public.corre_admin_do_usuario(uuid) to authenticated;


-- ─── 2. papeis_usuario: ninguém se promove ───────────────────────────────────
-- Auditoria 06/10: papeis_insert/papeis_update deixavam admin_associacao gravar
-- QUALQUER papel com o associacao_id dele — inclusive admin_trakto.
--   entregador:        só o próprio papel 'entregador', sem vínculo (o vínculo
--                      com a associação nasce na filiação aprovada)
--   admin_associacao:  só 'entregador'/'admin_associacao' da PRÓPRIA associação,
--                      nunca parceiro/contratante (parceiros não são do tenant)
--   admin_trakto:      tudo

alter table public.papeis_usuario enable row level security;

create or replace function public.corre_papel_do_tenant(
  _papel text, _associacao_id uuid, _parceiro_id uuid, _contratante_id uuid
) returns boolean
language sql stable security definer set search_path = public
as $$
  select _papel in ('entregador', 'admin_associacao')
     and _parceiro_id is null and _contratante_id is null
     and _associacao_id is not null
     and public.corre_admin_da_associacao(_associacao_id);
$$;
revoke all on function public.corre_papel_do_tenant(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.corre_papel_do_tenant(text, uuid, uuid, uuid) to authenticated;

drop policy if exists corre_trava_papeis_insert on public.papeis_usuario;
create policy corre_trava_papeis_insert on public.papeis_usuario
  as restrictive for insert to authenticated
  with check (
    public.corre_tem_papel('admin_trakto')
    or (usuario_id = auth.uid() and papel::text = 'entregador'
        and associacao_id is null and parceiro_id is null and contratante_id is null)
    or public.corre_papel_do_tenant(papel::text, associacao_id, parceiro_id, contratante_id)
  );

drop policy if exists corre_trava_papeis_update on public.papeis_usuario;
create policy corre_trava_papeis_update on public.papeis_usuario
  as restrictive for update to authenticated
  using (public.corre_tem_papel('admin_trakto')
         or public.corre_papel_do_tenant(papel::text, associacao_id, parceiro_id, contratante_id))
  with check (public.corre_tem_papel('admin_trakto')
              or public.corre_papel_do_tenant(papel::text, associacao_id, parceiro_id, contratante_id));

drop policy if exists corre_trava_papeis_delete on public.papeis_usuario;
create policy corre_trava_papeis_delete on public.papeis_usuario
  as restrictive for delete to authenticated
  using (public.corre_tem_papel('admin_trakto')
         or public.corre_papel_do_tenant(papel::text, associacao_id, parceiro_id, contratante_id));


-- ─── 2b. parceiros: plano (= tarifa) e moderação são do admin Trakto ─────────
-- Auditoria 06/10: parceiros_update deixava o parceiro trocar o próprio plano
-- (gratuito → premium baixa a tarifa de R$1,50 pra R$1,00) e sair de 'recusado'.
create or replace function public.corre_parceiros_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() or public.corre_tem_papel('admin_trakto') then
    return new;
  end if;
  if new.plano is distinct from old.plano then
    raise exception 'parceiros: plano só pelo admin Trakto' using errcode = '42501';
  end if;
  -- Parceiro pode pausar/retomar a própria vitrine; o resto é moderação.
  if new.status is distinct from old.status
     and not (old.status::text in ('ativo', 'pausado')
              and new.status::text in ('ativo', 'pausado')) then
    raise exception 'parceiros: status só pelo admin Trakto' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists corre_parceiros_proteger on public.parceiros;
create trigger corre_parceiros_proteger
  before update on public.parceiros
  for each row execute function public.corre_parceiros_proteger();


-- ─── 3. resgates: máquina de estados + trilha de auditoria ───────────────────
-- Regras validadas (CORRE_Regras_App_Seguranca_Escala):
--   gerado → validado   só o parceiro DAQUELE resgate, dentro de 15 min (relógio
--                       do servidor), via validar_resgate() — nunca UPDATE direto
--   gerado → expirado   só depois de vencido (fica pra métrica de funil)
--   gerado → cancelado  o próprio entregador
--   validado            final; estorno é evento novo em resgates_estornos
-- Só 'validado' sem estorno entra na cobrança, com a tarifa gravada na validação.

-- 3a. Tarifa por plano do PARCEIRO — configuração, não constante no código.
create table if not exists public.tarifas_ativacao (
  plano_parceiro text primary key,
  valor numeric(10, 2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now()
);
alter table public.tarifas_ativacao enable row level security;
drop policy if exists corre_tarifas_leitura on public.tarifas_ativacao;
create policy corre_tarifas_leitura on public.tarifas_ativacao
  for select to authenticated using (public.corre_tem_papel('admin_trakto'));
insert into public.tarifas_ativacao (plano_parceiro, valor)
values ('gratuito', 1.50), ('destaque', 1.00), ('premium', 1.00)
on conflict (plano_parceiro) do nothing;
-- PENDENTE (Chris): mapeamento suposto — enum plano_parceiro = gratuito |
-- destaque | premium; 'gratuito' = avulso R$1,50, pagantes = assinante R$1,00.
-- Plano sem linha aqui → tarifa_aplicada NULL → aparece em `sem_tarifa`.

alter table public.resgates add column if not exists plano_parceiro text;
alter table public.resgates add column if not exists tarifa_aplicada numeric(10, 2);

-- 3b. Código CC-XXXX gerado no servidor com CSPRNG (gen_random_uuid é
-- criptográfico e nativo — sem depender de extensão).
create or replace function public.corre_gerar_codigo()
returns text
language plpgsql volatile
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  r text := 'CC-';
begin
  for i in 0..3 loop  -- bytes 0..3 do UUID v4 são 100% aleatórios; 256 % 32 = 0
    r := r || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end;
$$;

-- 3c. Escala: com milhões de resgates, 32^4 ≈ 1M códigos esgotaria se o
-- código fosse único para sempre. Passa a ser único só entre os ABERTOS.
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
     where con.conrelid = 'public.resgates'::regclass and con.contype = 'u'
       and array_length(con.conkey, 1) = 1 and a.attname = 'codigo'
  loop
    execute format('alter table public.resgates drop constraint %I', c.conname);
  end loop;
  for c in
    select i.indexrelid::regclass as idx from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = 'public.resgates'::regclass and i.indisunique
       and i.indnatts = 1 and a.attname = 'codigo' and i.indpred is null
  loop
    execute format('drop index %s', c.idx);
  end loop;
end $$;

-- Fecha códigos já vencidos antes de criar os índices únicos de "aberto".
update public.resgates set status = 'expirado'
 where status = 'gerado' and gerado_em < now() - interval '15 minutes';

create unique index if not exists corre_resgates_codigo_aberto
  on public.resgates (codigo) where status = 'gerado';
-- Idempotência: um código aberto por (usuário, oferta). Toque duplo / retry de
-- rede batem aqui (23505) em vez de gerar dois códigos.
create unique index if not exists corre_resgates_um_aberto
  on public.resgates (usuario_id, oferta_id) where status = 'gerado';

-- 3d. Antes de inserir: TODAS as regras da oferta (o resgates_preparar_insert
-- citado no app nunca foi aplicado — conferido na auditoria de 06/10), rate
-- limit, idempotência e o servidor define código, parceiro, valor e horário.
-- Mensagens casam com motivoDoBanco() do app.
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

  -- Serializa por oferta: limites certos com milhares de toques simultâneos.
  perform pg_advisory_xact_lock(hashtext(new.oferta_id::text));

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

drop trigger if exists corre_resgates_antes_inserir on public.resgates;
create trigger corre_resgates_antes_inserir
  before insert on public.resgates
  for each row execute function public.corre_resgates_antes_inserir();

-- 3e. Antes de alterar: campos de auditoria imutáveis + máquina de estados.
create or replace function public.corre_resgates_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() then
    return new;
  end if;

  if new.usuario_id        is distinct from old.usuario_id
  or new.parceiro_id       is distinct from old.parceiro_id
  or new.oferta_id         is distinct from old.oferta_id
  or new.codigo            is distinct from old.codigo
  or new.gerado_em         is distinct from old.gerado_em
  or new.valor_economizado is distinct from old.valor_economizado
  or new.plano_parceiro    is distinct from old.plano_parceiro
  or new.tarifa_aplicada   is distinct from old.tarifa_aplicada then
    raise exception 'resgate: campos de auditoria não podem ser alterados'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    if new.validado_em  is distinct from old.validado_em
    or new.validado_por is distinct from old.validado_por then
      raise exception 'resgate: validação só pela transição de status'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status::text = 'gerado' and new.status::text = 'validado' then
    if not (public.corre_parceiro_de(old.parceiro_id)
            or public.corre_tem_papel('admin_trakto')) then
      raise exception 'resgate: só o parceiro valida o resgate'
        using errcode = '42501';
    end if;
    if old.gerado_em < now() - interval '15 minutes' then
      raise exception 'resgate: código vencido' using errcode = 'P0001';
    end if;
    new.validado_em  := now();
    new.validado_por := auth.uid();
    select p.plano::text into new.plano_parceiro
      from public.parceiros p where p.id = old.parceiro_id;
    select t.valor into new.tarifa_aplicada
      from public.tarifas_ativacao t where t.plano_parceiro = new.plano_parceiro;
    return new;
  end if;

  if old.status::text = 'gerado' and new.status::text = 'expirado' then
    if old.gerado_em >= now() - interval '15 minutes' then
      raise exception 'resgate: código ainda no prazo' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status::text = 'gerado' and new.status::text = 'cancelado'
     and (old.usuario_id = auth.uid() or public.corre_tem_papel('admin_trakto')) then
    return new;
  end if;

  raise exception 'resgate: transição % → % não permitida', old.status, new.status
    using errcode = '42501';
end;
$$;

drop trigger if exists corre_resgates_proteger on public.resgates;
create trigger corre_resgates_proteger
  before update on public.resgates
  for each row execute function public.corre_resgates_proteger();

drop trigger if exists corre_resgates_congelar_plano on public.resgates;
drop function if exists public.corre_resgates_congelar_plano();

alter table public.resgates enable row level security;

-- 3f. Resgate nunca é apagado (auditoria, funil, cobrança).
drop policy if exists corre_trava_resgates_delete on public.resgates;
create policy corre_trava_resgates_delete on public.resgates
  as restrictive for delete to authenticated
  using (false);

-- 3g. Leitura: dono, parceiro do resgate, admin da associação do entregador.
drop policy if exists corre_trava_resgates_select on public.resgates;
create policy corre_trava_resgates_select on public.resgates
  as restrictive for select to authenticated
  using (usuario_id = auth.uid()
         or public.corre_parceiro_de(parceiro_id)
         or public.corre_admin_do_usuario(usuario_id));

-- 3h. UPDATE direto: só o dono (cancelar) ou admin_trakto. O parceiro valida
-- SÓ por validar_resgate() — UPDATE direto pularia o limite de tentativas.
drop policy if exists corre_trava_resgates_update on public.resgates;
create policy corre_trava_resgates_update on public.resgates
  as restrictive for update to authenticated
  using (usuario_id = auth.uid() or public.corre_tem_papel('admin_trakto'))
  with check (usuario_id = auth.uid() or public.corre_tem_papel('admin_trakto'));

-- 3i. Insert só em nome próprio.
drop policy if exists corre_trava_resgates_insert on public.resgates;
create policy corre_trava_resgates_insert on public.resgates
  as restrictive for insert to authenticated
  with check (usuario_id = auth.uid());

-- 3j. Validação no balcão: rate limit + log de TODA tentativa.
create table if not exists public.tentativas_validacao (
  id bigint generated always as identity primary key,
  parceiro_id uuid not null,
  usuario_id uuid not null,
  codigo_digitado text not null,
  resgate_id text,  -- texto: independe do tipo de resgates.id
  resultado text not null,  -- ok | codigo_invalido | bloqueado
  criado_em timestamptz not null default now()
);
create index if not exists corre_tentativas_usuario_idx
  on public.tentativas_validacao (usuario_id, criado_em desc);
alter table public.tentativas_validacao enable row level security;
drop policy if exists corre_tentativas_leitura on public.tentativas_validacao;
create policy corre_tentativas_leitura on public.tentativas_validacao
  for select to authenticated using (public.corre_tem_papel('admin_trakto'));

create or replace function public.validar_resgate(_codigo text, _parceiro_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cod text := upper(trim(_codigo));
  v_erros_min int;
  v_erros_hora int;
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

  if v_erros_min >= 5 or v_erros_hora >= 20 then
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

-- 3k. Estorno: evento novo (append-only), motivo obrigatório, janela limitada.
create table if not exists public.resgates_estornos (
  id bigint generated always as identity primary key,
  resgate_id text not null unique,  -- um estorno por resgate
  motivo text not null check (length(trim(motivo)) >= 5),
  estornado_por uuid not null,
  criado_em timestamptz not null default now()
);
alter table public.resgates_estornos enable row level security;
drop policy if exists corre_estornos_leitura on public.resgates_estornos;
create policy corre_estornos_leitura on public.resgates_estornos
  for select to authenticated
  using (estornado_por = auth.uid() or public.corre_tem_papel('admin_trakto'));
-- Sem política de insert/update/delete: só estornar_resgate() escreve.

create or replace function public.estornar_resgate(_resgate_id text, _motivo text)
returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  select id, parceiro_id, status, validado_em into r
    from public.resgates where id::text = _resgate_id;
  if not found or not (public.corre_parceiro_de(r.parceiro_id)
                       or public.corre_tem_papel('admin_trakto')) then
    raise exception 'estorno: sem permissão' using errcode = '42501';
  end if;
  if r.status::text <> 'validado' then
    raise exception 'estorno: só resgate validado' using errcode = 'P0001';
  end if;
  -- PENDENTE (negócio): janela máxima. Sugestão validada: mesmo dia.
  if (r.validado_em at time zone 'America/Sao_Paulo')::date
     <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'estorno: fora da janela (mesmo dia)' using errcode = 'P0001';
  end if;
  insert into public.resgates_estornos (resgate_id, motivo, estornado_por)
  values (_resgate_id, trim(_motivo), auth.uid());
end;
$$;

revoke all on function public.estornar_resgate(text, text) from public, anon;
grant execute on function public.estornar_resgate(text, text) to authenticated;

-- Privilégios explícitos (não depender do default do schema): anon não toca;
-- authenticated só lê, e as políticas acima filtram as linhas.
revoke all on public.tarifas_ativacao, public.tentativas_validacao,
  public.resgates_estornos from anon, authenticated;
grant select on public.tarifas_ativacao, public.tentativas_validacao,
  public.resgates_estornos to authenticated;

-- 3l. Fatura do dia 1º: só soma o que já está gravado (não reconsulta plano).
create or replace view public.cobranca_ativacoes
with (security_invoker = true) as
select r.parceiro_id,
       date_trunc('month', r.validado_em at time zone 'America/Sao_Paulo')::date as mes,
       count(*) as ativacoes,
       coalesce(sum(r.tarifa_aplicada), 0) as total,
       count(*) filter (where r.tarifa_aplicada is null) as sem_tarifa
  from public.resgates r
 where r.status = 'validado'
   and not exists (select 1 from public.resgates_estornos e
                    where e.resgate_id = r.id::text)
 group by 1, 2;

revoke all on public.cobranca_ativacoes from anon, authenticated;
grant select on public.cobranca_ativacoes to authenticated;

-- ─── 4. usuarios: cada um no seu; plano e status são do admin ────────────────

create or replace function public.corre_usuarios_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() or public.corre_tem_papel('admin_trakto') then
    return new;
  end if;
  if new.id     is distinct from old.id
  or new.plano  is distinct from old.plano
  or new.status is distinct from old.status then
    raise exception 'usuarios: plano e status só pelo admin'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Insert: o app cria a própria linha (garantirPerfil) — plano e status nascem
-- fixos. Não existia trigger nenhum (auditoria 06/10): dava pra nascer premium.
create or replace function public.corre_usuarios_ao_criar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.corre_eh_backend() and not public.corre_tem_papel('admin_trakto') then
    new.plano  := 'free';
    new.status := 'ativo';
  end if;
  return new;
end;
$$;

drop trigger if exists corre_usuarios_ao_criar on public.usuarios;
create trigger corre_usuarios_ao_criar
  before insert on public.usuarios
  for each row execute function public.corre_usuarios_ao_criar();

drop trigger if exists corre_usuarios_proteger on public.usuarios;
create trigger corre_usuarios_proteger
  before update on public.usuarios
  for each row execute function public.corre_usuarios_proteger();

alter table public.usuarios enable row level security;

-- Auditoria 06/10: usuarios_delete_admin deixava apagar a própria linha.
-- Exclusão de conta é anonimização (seção 7), nunca DELETE pelo app.
drop policy if exists corre_trava_usuarios_delete on public.usuarios;
create policy corre_trava_usuarios_delete on public.usuarios
  as restrictive for delete to authenticated
  using (public.corre_tem_papel('admin_trakto'));
drop policy if exists corre_trava_usuarios_proprio on public.usuarios;
create policy corre_trava_usuarios_proprio on public.usuarios
  as restrictive for all to authenticated
  using (id = auth.uid() or public.corre_admin_do_usuario(id))
  with check (id = auth.uid() or public.corre_tem_papel('admin_trakto'));
-- ATENÇÃO: se o parceiro precisa ver o nome do entregador na validação, isso
-- deve vir por função SECURITY DEFINER que devolve só o nome — não abrindo a
-- tabela inteira para o papel parceiro.


-- ─── 5. associados / filiação: isolamento por associacao_id ──────────────────

alter table public.associados enable row level security;
drop policy if exists corre_trava_associados on public.associados;
create policy corre_trava_associados on public.associados
  as restrictive for all to authenticated
  using (usuario_id = auth.uid()
         or public.corre_admin_da_associacao(associacao_id))
  with check (public.corre_admin_da_associacao(associacao_id));
-- Entregador lê a própria carteirinha; criar/alterar associado é da diretoria.
-- Auditoria 06/10: associados_insert aceitava usuario_id = auth.uid() — o
-- entregador criava a própria carteirinha sem aprovação.

alter table public.solicitacoes_filiacao enable row level security;
drop policy if exists corre_trava_filiacao_leitura on public.solicitacoes_filiacao;
create policy corre_trava_filiacao_leitura on public.solicitacoes_filiacao
  as restrictive for select to authenticated
  using (usuario_id = auth.uid()
         or public.corre_admin_da_associacao(associacao_id));

drop policy if exists corre_trava_filiacao_insert on public.solicitacoes_filiacao;
create policy corre_trava_filiacao_insert on public.solicitacoes_filiacao
  as restrictive for insert to authenticated
  with check (usuario_id = auth.uid() and status::text = 'pendente');

drop policy if exists corre_trava_filiacao_update on public.solicitacoes_filiacao;
create policy corre_trava_filiacao_update on public.solicitacoes_filiacao
  as restrictive for update to authenticated
  using (public.corre_admin_da_associacao(associacao_id))
  with check (public.corre_admin_da_associacao(associacao_id));


-- ─── 5b. Token da carteirinha ────────────────────────────────────────────────
-- Auditoria 06/10: dono, CSPRNG e 90s já corretos. Único ajuste: associado
-- desligado não gera mais token (suspenso/inadimplente seguem identificados —
-- o selo de status aparece na verificação).
create or replace function public.gerar_token_carteirinha(_associado_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare v_token text;
begin
  if not exists (
    select 1 from public.associados a
     where a.id = _associado_id and a.usuario_id = auth.uid()
       and a.status <> 'desligado'
  ) then
    raise exception 'nao autorizado';
  end if;
  delete from public.tokens_carteirinha
   where associado_id = _associado_id and expira_em < now() - interval '5 minutes';
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); -- pgcrypto fica em extensions no Supabase
  insert into public.tokens_carteirinha (token, associado_id, expira_em)
  values (v_token, _associado_id, now() + interval '90 seconds');
  return v_token;
end;
$function$;


-- ─── 6. Leitura anônima de associacoes ───────────────────────────────────────
-- Hoje: "permission denied for function eh_admin_associacao" para anon.
-- A função só responde sobre auth.uid() (nulo para anon → false), então liberar
-- EXECUTE é seguro — CONFIRA o corpo na auditoria antes.

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'eh_admin_associacao'
  loop
    execute format('grant execute on function %s to anon', f);
  end loop;
end $$;

-- ─── 7. Exclusão de conta (LGPD art. 16 + exigência das lojas) ─────────────
-- Anonimiza, nunca apaga: resgates ficam (parceiro, valor, data, status) para
-- cobrança/auditoria pelo prazo de guarda (PENDENTE: 5 anos, confirmar com
-- contador/advogado). Chamada só pela Edge Function `excluir-conta`
-- (service_role), que depois BANE o usuário no Auth (não deleta, se houver FK
-- de usuarios/resgates para auth.users com cascade).

create or replace function public.corre_anonimizar_usuario(_usuario_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.corre_eh_backend() then
    raise exception 'anonimizar: só via Edge Function' using errcode = '42501';
  end if;
  update public.resgates set status = 'cancelado'
   where usuario_id = _usuario_id and status = 'gerado';
  update public.usuarios
     set nome = 'Conta excluída', email = null, cpf = null, telefone = null,
         foto_url = null, placa = null
   where id = _usuario_id;
  update public.solicitacoes_filiacao
     set nome = 'Conta excluída', cpf = null, telefone = null, placa = null
   where usuario_id = _usuario_id;
  -- Baixa na associação: o painel da ASSEMAG vê o desligamento.
  update public.associados set status = 'desligado'
   where usuario_id = _usuario_id;
  delete from public.papeis_usuario where usuario_id = _usuario_id;
end;
$$;

revoke all on function public.corre_anonimizar_usuario(uuid)
  from public, anon, authenticated;
grant execute on function public.corre_anonimizar_usuario(uuid) to service_role;

commit;


-- ─── 8. Checklist manual (corpo de funções que não temos aqui) ───────────────
-- gerar_token_carteirinha(_associado_id): conferido na auditoria 06/10
--   [x] recusa se associados.usuario_id <> auth.uid()
--   [x] recusa desligado (5b)
--   [x] token aleatório (2x gen_random_uuid), expira em 90s
--   [x] execute revogado de anon
-- Verificação pública /verificar/:token (função de servidor do web):
--   [x] aceita SÓ tokens_carteirinha com expira_em > now() — nunca o
--       associados.qr_token (fixo: print de tela valeria pra sempre)
--   [x] devolve só nome, foto, status e associação — nunca CPF completo
-- Validação do resgate pelo parceiro:
--   [x] só usuário com papel parceiro DAQUELE parceiro_id valida (3e/3j)
--   [x] rate limit + log de toda tentativa (3j: validar_resgate)
--   [x] resgate 'gerado' com mais de 15 min não pode ser validado (3e)
--   [ ] Painel Parceiro migrado de UPDATE direto para rpc('validar_resgate')
--   [ ] alerta para admin Trakto quando houver 'bloqueado' (ler tentativas_validacao)
-- Regras validadas que dependem de dados que ainda não existem:
--   [ ] carência do inadimplente (sugestão 7 dias): precisa de
--       associados.inadimplente_desde + ajuste no trigger resgates_preparar_insert
--   [ ] validade_carteirinha derivada do pagamento (depende do gateway)
--   [ ] confirmar tarifas: gratuito=1,50 / destaque=1,00 / premium=1,00 (3a)
