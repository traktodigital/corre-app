-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 8: Jornada do dia + dados do agente Seu Ligeirin (ADR-0005).
-- Rodar DEPOIS da parte 7 (redefine corre_anonimizar_dados).
--
-- Regras:
--   - Tabelas novas: RLS só do dono, desde a criação (ADR-0001 D1).
--   - Horário e dono vêm do servidor, nunca do aparelho.
--   - Uma jornada aberta por vez (constraint, não checagem no app).
--   - `suspeita` só o servidor marca (ADR-0002 D4): marca, não bloqueia.
--   - Conta é do banco: resumo_jornadas() calcula; a IA só narra (ADR-0005 D5).
--   - Exclusão de conta APAGA jornada/ganhos/abastecimentos (não é dado fiscal).

-- ─── Apps de entrega (catálogo) ─────────────────────────────────────────────
-- Catálogo do Léo (ADR-0005 §6.3). `ordem` = ordem na tela de abertura.
create table if not exists public.apps_entrega (
  id text primary key,
  nome text not null,
  ordem smallint not null default 100,
  ativo boolean not null default true
);
insert into public.apps_entrega (id, nome, ordem) values
  ('ifood', 'iFood', 1), ('99', '99', 2), ('rappi', 'Rappi', 3), ('uber', 'Uber', 4),
  ('shopee', 'Shopee', 5), ('mercadolivre', 'Mercado Livre', 6),
  ('lalamove', 'Lalamove', 7), ('loggi', 'Loggi', 8), ('outro', 'Outro', 99)
on conflict (id) do nothing;
alter table public.apps_entrega enable row level security;
drop policy if exists corre_apps_leitura on public.apps_entrega;
create policy corre_apps_leitura on public.apps_entrega
  for select to anon, authenticated using (true);

-- ─── Jornadas ───────────────────────────────────────────────────────────────
-- id pode vir do aparelho (UUID): reenvio por rede ruim não duplica jornada.
create table if not exists public.jornadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'encerrada')),
  km_gps numeric(8, 2) check (km_gps >= 0),
  odometro_inicio integer check (odometro_inicio >= 0),
  odometro_fim integer check (odometro_fim >= 0),
  -- Foto do painel (odômetro + tanque) na abertura e no encerramento (§6.2).
  foto_painel_inicio text,
  foto_painel_fim text,
  combustivel text check (combustivel in ('gasolina', 'etanol')),
  nivel_tanque_inicio smallint check (nivel_tanque_inicio between 0 and 100),
  celula text,  -- região aproximada (~1 km) para a inteligência coletiva (ADR-0002 §6b)
  trajeto_path text,  -- arquivo do trajeto no Storage (ADR-0002 G1)
  suspeita boolean not null default false,
  check (odometro_fim is null or odometro_inicio is null or odometro_fim >= odometro_inicio),
  check ((status = 'encerrada') = (encerrada_em is not null))
);
create unique index if not exists corre_jornada_uma_aberta
  on public.jornadas (usuario_id) where status = 'em_andamento';
create index if not exists corre_jornadas_usuario_idx
  on public.jornadas (usuario_id, iniciada_em desc);

create or replace function public.corre_jornadas_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_horas numeric;
  v_odo numeric;
  v_km numeric;
begin
  if public.corre_eh_backend() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.usuario_id   := auth.uid();
    new.iniciada_em  := now();
    new.status       := 'em_andamento';
    new.encerrada_em := null;
    new.km_gps          := null;
    new.odometro_fim    := null;
    new.foto_painel_fim := null;
    new.trajeto_path    := null;
    new.suspeita        := false;
    return new;
  end if;

  if old.status = 'encerrada' then
    raise exception 'jornada ja encerrada' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
  or new.usuario_id is distinct from old.usuario_id
  or new.iniciada_em is distinct from old.iniciada_em then
    raise exception 'jornada: campos imutaveis' using errcode = '42501';
  end if;

  new.suspeita := false;
  if new.status <> 'encerrada' then
    new.encerrada_em := null;
    return new;
  end if;

  -- Encerramento: horário do servidor + plausibilidade.
  new.encerrada_em := now();
  v_horas := extract(epoch from new.encerrada_em - new.iniciada_em) / 3600;
  v_odo := (new.odometro_fim - new.odometro_inicio)::numeric;
  v_km := coalesce(new.km_gps, v_odo);
  -- ponytail: limiares fixos (moto urbana); viram config por associação se outra categoria entrar.
  new.suspeita := v_km is not null and (
       v_km > 800
    or (v_horas > 0 and v_km / v_horas > 90)
    or (new.km_gps is not null and v_odo is not null
        and abs(new.km_gps - v_odo) > greatest(5, 0.3 * v_odo))
  );
  return new;
end;
$$;

drop trigger if exists corre_jornadas_proteger on public.jornadas;
create trigger corre_jornadas_proteger
  before insert or update on public.jornadas
  for each row execute function public.corre_jornadas_proteger();

alter table public.jornadas enable row level security;
drop policy if exists corre_jornadas_dono on public.jornadas;
create policy corre_jornadas_dono on public.jornadas
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ─── Apps da jornada + ganho de cada um ─────────────────────────────────────
-- A linha nasce na ABERTURA (app marcado, valor nulo) e o valor chega no
-- encerramento, com o comprovante (print/PDF). 1 linha = rodou num app só.
-- origem 'comprovante_ia' = o Ligeirin leu o comprovante e o entregador confirmou.
create table if not exists public.jornada_ganhos (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas (id) on delete cascade,
  usuario_id uuid not null default auth.uid(),
  app_id text not null references public.apps_entrega (id),
  valor numeric(10, 2) check (valor >= 0 and valor <= 5000),
  corridas integer check (corridas >= 0 and corridas <= 200),
  comprovantes text[] not null default '{}',  -- caminhos no Storage
  origem text not null default 'digitado' check (origem in ('digitado', 'comprovante_ia')),
  unique (jornada_id, app_id)
);
alter table public.jornada_ganhos enable row level security;
drop policy if exists corre_ganhos_dono on public.jornada_ganhos;
create policy corre_ganhos_dono on public.jornada_ganhos
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from public.jornadas j
                 where j.id = jornada_id and j.usuario_id = (select auth.uid()))
  );

-- ─── Abastecimentos ─────────────────────────────────────────────────────────
-- origem: 'foto_ia' = o Ligeirin leu o cupom e o entregador confirmou (ADR-0005 D6).
-- 3 fotos (§6.2): cupom, odômetro, marcador depois de abastecer. Sem cupom é
-- permitido (o Ligeirin insiste antes), mas fica `sem_cupom` e fora da média
-- de preço da inteligência coletiva.
create table if not exists public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  jornada_id uuid references public.jornadas (id) on delete set null,
  abastecido_em timestamptz not null default now(),
  combustivel text check (combustivel in ('gasolina', 'etanol')),
  litros numeric(6, 2) check (litros > 0 and litros <= 100),
  valor_total numeric(8, 2) not null check (valor_total > 0 and valor_total <= 2000),
  preco_litro numeric(6, 3) generated always as (round(valor_total / nullif(litros, 0), 3)) stored,
  odometro integer check (odometro >= 0),
  posto text check (length(posto) <= 120),
  posto_cnpj text check (posto_cnpj ~ '^[0-9]{14}$'),
  celula text,
  foto_cupom text,
  foto_odometro text,
  foto_marcador text,
  sem_cupom boolean generated always as (foto_cupom is null) stored,
  origem text not null default 'digitado' check (origem in ('digitado', 'foto_ia')),
  criado_em timestamptz not null default now()
);
create index if not exists corre_abastecimentos_usuario_idx
  on public.abastecimentos (usuario_id, abastecido_em desc);
alter table public.abastecimentos enable row level security;
drop policy if exists corre_abastecimentos_dono on public.abastecimentos;
create policy corre_abastecimentos_dono on public.abastecimentos
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and (jornada_id is null or exists (
      select 1 from public.jornadas j
       where j.id = jornada_id and j.usuario_id = (select auth.uid())))
  );

revoke all on public.jornadas, public.jornada_ganhos, public.abastecimentos from anon;
grant select, insert, update, delete
  on public.jornadas, public.jornada_ganhos, public.abastecimentos to authenticated;
grant select on public.apps_entrega to anon, authenticated;

-- ─── Resumo (o Ligeirin narra; quem calcula é aqui) ─────────────────────────
-- Período [_inicio, _fim) OU uma jornada (_jornada_id). SECURITY INVOKER: a RLS
-- vale, então o Archon com o token do usuário só vê os dados dele (ADR-0005 D8).
create or replace function public.resumo_jornadas(
  _inicio timestamptz default null,
  _fim timestamptz default null,
  _jornada_id uuid default null
) returns jsonb
language sql stable security invoker set search_path = public
as $$
  with j as (
    select id, iniciada_em, coalesce(encerrada_em, now()) as fim,
           coalesce(km_gps, (odometro_fim - odometro_inicio)::numeric, 0) as km
      from public.jornadas
     where usuario_id = auth.uid()
       and (case when _jornada_id is not null then id = _jornada_id
                 else iniciada_em >= _inicio and iniciada_em < _fim end)
  ), t as (
    select count(*) as jornadas,
           coalesce(sum(km), 0) as km,
           coalesce(sum(extract(epoch from fim - iniciada_em)) / 3600, 0)::numeric as horas
      from j
  ), g as (
    select gn.app_id, sum(gn.valor) as valor, sum(gn.corridas) as corridas
      from public.jornada_ganhos gn join j on j.id = gn.jornada_id
     group by gn.app_id
  ), a as (
    select coalesce(sum(valor_total), 0) as gasto, coalesce(sum(litros), 0) as litros
      from public.abastecimentos
     where usuario_id = auth.uid()
       and (case when _jornada_id is not null then jornada_id = _jornada_id
                 else abastecido_em >= _inicio and abastecido_em < _fim end)
  ), s as (
    select t.*, a.gasto, a.litros, coalesce((select sum(valor) from g), 0) as ganho
      from t, a
  )
  select jsonb_build_object(
    'jornadas', s.jornadas,
    'km', round(s.km, 1),
    'horas', round(s.horas, 1),
    'litros', s.litros,
    'gasto_combustivel', s.gasto,
    'ganho_total', s.ganho,
    'lucro', s.ganho - s.gasto,
    'custo_km', case when s.km > 0 then round(s.gasto / s.km, 2) end,
    'ganho_km', case when s.km > 0 then round(s.ganho / s.km, 2) end,
    'ganho_hora', case when s.horas > 0 then round(s.ganho / s.horas, 2) end,
    'por_app', coalesce((
      select jsonb_agg(jsonb_build_object(
               'app', g.app_id, 'valor', g.valor, 'corridas', g.corridas,
               'por_corrida', case when g.corridas > 0 then round(g.valor / g.corridas, 2) end)
             order by g.valor desc nulls last)
        from g), '[]'::jsonb)
  )
  from s;
$$;

revoke all on function public.resumo_jornadas(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.resumo_jornadas(timestamptz, timestamptz, uuid) to authenticated;

-- ─── Storage: fotos de cupom/odômetro, pasta por usuário ────────────────────
-- Só existe no Supabase (o stub de teste não tem schema storage).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('jornada-fotos', 'jornada-fotos', false)
    on conflict (id) do nothing;
    execute 'drop policy if exists corre_jornada_fotos_dono on storage.objects';
    execute $p$
      create policy corre_jornada_fotos_dono on storage.objects
        for all to authenticated
        using (bucket_id = 'jornada-fotos'
               and (storage.foldername(name))[1] = (select auth.uid())::text)
        with check (bucket_id = 'jornada-fotos'
                    and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
  end if;
end $$;

-- ─── Exclusão de conta: agora também apaga a jornada ────────────────────────
-- Mesmo corpo da parte 7 + os deletes. As FOTOS no Storage a Edge Function
-- `excluir-conta` apaga pela API (pasta jornada-fotos/<usuario_id>/).
create or replace function public.corre_anonimizar_dados(_usuario_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.resgates set status = 'cancelado'
   where usuario_id = _usuario_id and status = 'gerado';
  update public.usuarios
     set nome = 'Conta excluída', email = null, cpf = null, telefone = null,
         foto_url = null, placa = null
   where id = _usuario_id;
  update public.solicitacoes_filiacao
     set nome = 'Conta excluída', cpf = null, telefone = null, placa = null
   where usuario_id = _usuario_id;
  update public.associados set status = 'desligado'
   where usuario_id = _usuario_id;
  delete from public.papeis_usuario where usuario_id = _usuario_id;
  -- Jornada não é dado fiscal: apaga (ADR-0002 L6). Ganhos vão em cascata.
  delete from public.abastecimentos where usuario_id = _usuario_id;
  delete from public.jornadas where usuario_id = _usuario_id;
end;
$$;

revoke all on function public.corre_anonimizar_dados(uuid)
  from public, anon, authenticated, service_role;
