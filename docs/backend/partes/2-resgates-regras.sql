-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 2/5 de seguranca-fase1.sql — rodar NA ORDEM, uma por vez.

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
