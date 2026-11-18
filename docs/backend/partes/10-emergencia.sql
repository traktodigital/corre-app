-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 10: botão de emergência, v1 (ADR-0006).
-- Rodar DEPOIS da parte 8 (redefine corre_anonimizar_dados).
--
-- Regras:
--   - Contato de emergência é dado de terceiro: RLS só do dono (D7).
--   - Eventos são append-only (D6): sem update nem delete pelo app.
--   - Dono e horário vêm do servidor, nunca do aparelho.
--   - Exclusão de conta apaga contato e eventos (localização é dado pessoal).

-- ─── Contato de emergência (um por entregador) ──────────────────────────────
create table if not exists public.contatos_emergencia (
  usuario_id uuid primary key default auth.uid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  telefone text not null check (telefone ~ '^[0-9]{10,13}$'),
  atualizado_em timestamptz not null default now()
);

create or replace function public.corre_contato_emergencia_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() then
    return new;
  end if;
  new.usuario_id := auth.uid();
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists corre_contato_emergencia_proteger on public.contatos_emergencia;
create trigger corre_contato_emergencia_proteger
  before insert or update on public.contatos_emergencia
  for each row execute function public.corre_contato_emergencia_proteger();

alter table public.contatos_emergencia enable row level security;
drop policy if exists corre_contato_emergencia_dono on public.contatos_emergencia;
create policy corre_contato_emergencia_dono on public.contatos_emergencia
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ─── Eventos da emergência (append-only) ────────────────────────────────────
-- O primeiro evento ('acionou') gera o emergencia_id; os seguintes reusam.
create table if not exists public.emergencia_eventos (
  id uuid primary key default gen_random_uuid(),
  emergencia_id uuid not null default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  tipo text not null
    check (tipo in ('acionou', 'ligou_192', 'ligou_193', 'avisou_contato', 'encerrou')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  precisao_m real check (precisao_m >= 0),
  criado_em timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index if not exists corre_emergencia_eventos_usuario_idx
  on public.emergencia_eventos (usuario_id, criado_em desc);
create index if not exists corre_emergencia_eventos_emergencia_idx
  on public.emergencia_eventos (emergencia_id);

create or replace function public.corre_emergencia_eventos_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() then
    return new;
  end if;
  new.usuario_id := auth.uid();
  new.criado_em := now();
  if new.tipo <> 'acionou' and not exists (
    select 1 from public.emergencia_eventos e
     where e.emergencia_id = new.emergencia_id
       and e.usuario_id = new.usuario_id
       and e.tipo = 'acionou'
  ) then
    raise exception 'emergencia inexistente' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists corre_emergencia_eventos_proteger on public.emergencia_eventos;
create trigger corre_emergencia_eventos_proteger
  before insert on public.emergencia_eventos
  for each row execute function public.corre_emergencia_eventos_proteger();

alter table public.emergencia_eventos enable row level security;
drop policy if exists corre_emergencia_eventos_ler on public.emergencia_eventos;
create policy corre_emergencia_eventos_ler on public.emergencia_eventos
  for select to authenticated
  using (usuario_id = (select auth.uid()));
drop policy if exists corre_emergencia_eventos_inserir on public.emergencia_eventos;
create policy corre_emergencia_eventos_inserir on public.emergencia_eventos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

revoke all on public.contatos_emergencia, public.emergencia_eventos from anon;
revoke update, delete, truncate on public.emergencia_eventos from authenticated;
grant select, insert, update, delete on public.contatos_emergencia to authenticated;
grant select, insert on public.emergencia_eventos to authenticated;

-- ─── Exclusão de conta (redefine a versão da parte 8) ───────────────────────
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
  delete from public.abastecimentos where usuario_id = _usuario_id;
  delete from public.jornadas where usuario_id = _usuario_id;
  delete from public.contatos_emergencia where usuario_id = _usuario_id;
  delete from public.emergencia_eventos where usuario_id = _usuario_id;
end;
$$;

revoke all on function public.corre_anonimizar_dados(uuid)
  from public, anon, authenticated, service_role;
