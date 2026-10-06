-- Parte 1/5 de seguranca-fase1.sql — rodar NA ORDEM, uma por vez.
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

commit;
