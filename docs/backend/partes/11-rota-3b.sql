-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 11: rota da 3B Indenizações atrás de flag (ADR-0006 D8 e §3b).
-- Rodar DEPOIS da parte 10.
--
-- Regras:
--   - A flag nasce DESLIGADA. Só o admin liga, pelo SQL editor:
--       update public.app_flags set ligada = true, atualizado_em = now() where chave = 'rota_3b';
--   - Com a flag desligada o banco recusa consentimento e lead da 3B,
--     mesmo que o app seja alterado. Revogar é sempre permitido.
--   - Consentimento e lead são append-only (prova do consentimento).
--   - As respostas do formulário (data, lesão, app) NÃO ficam no banco:
--     vão só na mensagem que o próprio entregador envia no WhatsApp.

-- ─── Flags do app ───────────────────────────────────────────────────────────
create table if not exists public.app_flags (
  chave text primary key,
  ligada boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into public.app_flags (chave, ligada) values ('rota_3b', false)
on conflict (chave) do nothing;

alter table public.app_flags enable row level security;
drop policy if exists corre_flags_leitura on public.app_flags;
create policy corre_flags_leitura on public.app_flags
  for select to anon, authenticated using (true);
revoke all on public.app_flags from anon, authenticated;
grant select on public.app_flags to anon, authenticated;

create or replace function public.corre_flag_ligada(_chave text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select ligada from public.app_flags where chave = _chave), false);
$$;
revoke all on function public.corre_flag_ligada(text) from public, anon, authenticated;

-- ─── Textos de consentimento (versionados) ──────────────────────────────────
-- O app mostra o texto vigente (o mais novo da finalidade). Para publicar o
-- texto do jurídico, INSERIR uma versão nova (o histórico fica):
--   insert into public.textos_consentimento (finalidade, versao, texto)
--   values ('3b_indenizacao', '3b-AAAA-MM-DD', '<texto>');
create table if not exists public.textos_consentimento (
  finalidade text not null check (finalidade in ('3b_indenizacao')),
  versao text not null check (char_length(versao) between 1 and 60),
  texto text not null check (char_length(texto) between 20 and 4000),
  criado_em timestamptz not null default now(),
  primary key (finalidade, versao)
);
insert into public.textos_consentimento (finalidade, versao, texto) values (
  '3b_indenizacao', '3b-2026-11-17-provisorio',
  'Ao tocar em Concordo e continuar, você autoriza a Trakto Digital, pelo app CORRE, '
  || 'a compartilhar com a 3B Indenizações seu nome, telefone, e-mail, o CPF (se você marcou) '
  || 'e as informações do acidente (data, se estava trabalhando, se teve lesão e o app usado), '
  || 'para que ela analise gratuitamente seus direitos e entre em contato com você. '
  || 'A Trakto também informa à 3B, uma vez por mês, que você usou este canal. '
  || 'Você pode revogar quando quiser em Perfil.'
) on conflict (finalidade, versao) do nothing;

alter table public.textos_consentimento enable row level security;
drop policy if exists corre_textos_consentimento_leitura on public.textos_consentimento;
create policy corre_textos_consentimento_leitura on public.textos_consentimento
  for select to authenticated using (true);
revoke all on public.textos_consentimento from anon, authenticated;
grant select on public.textos_consentimento to authenticated;

-- ─── Consentimentos (append-only) ───────────────────────────────────────────
create table if not exists public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  finalidade text not null check (finalidade in ('3b_indenizacao')),
  acao text not null check (acao in ('aceitou', 'revogou')),
  versao_texto text not null check (char_length(versao_texto) between 1 and 60),
  criado_em timestamptz not null default now()
);
create index if not exists corre_consentimentos_usuario_idx
  on public.consentimentos (usuario_id, finalidade, criado_em desc);

create or replace function public.corre_consentimentos_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.corre_eh_backend() then
    return new;
  end if;
  new.usuario_id := auth.uid();
  new.criado_em := now();
  select t.versao into new.versao_texto
    from public.textos_consentimento t
   where t.finalidade = new.finalidade
   order by t.criado_em desc, t.versao desc
   limit 1;
  if new.versao_texto is null then
    raise exception 'sem texto de consentimento vigente' using errcode = 'P0001';
  end if;
  if new.acao = 'aceitou' and new.finalidade = '3b_indenizacao'
     and not public.corre_flag_ligada('rota_3b') then
    raise exception 'rota da 3B desligada' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists corre_consentimentos_proteger on public.consentimentos;
create trigger corre_consentimentos_proteger
  before insert on public.consentimentos
  for each row execute function public.corre_consentimentos_proteger();

alter table public.consentimentos enable row level security;
drop policy if exists corre_consentimentos_ler on public.consentimentos;
create policy corre_consentimentos_ler on public.consentimentos
  for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists corre_consentimentos_inserir on public.consentimentos;
create policy corre_consentimentos_inserir on public.consentimentos
  for insert to authenticated with check (usuario_id = (select auth.uid()));

-- ─── Leads para parceiros (append-only) ─────────────────────────────────────
-- 1 linha = o entregador tocou em "Abrir WhatsApp da 3B" depois de consentir.
-- É o que vai no relatório do dia 10 (aplicar/8-relatorio-leads-3b.sql).
create table if not exists public.leads_parceiros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  parceiro text not null check (parceiro in ('3b')),
  versao_consentimento text not null,
  criado_em timestamptz not null default now()
);
create index if not exists corre_leads_parceiros_idx
  on public.leads_parceiros (parceiro, criado_em desc);

create or replace function public.corre_leads_proteger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_acao text;
  v_versao text;
begin
  if public.corre_eh_backend() then
    return new;
  end if;
  new.usuario_id := auth.uid();
  new.criado_em := now();
  if not public.corre_flag_ligada('rota_3b') then
    raise exception 'rota da 3B desligada' using errcode = 'P0001';
  end if;
  select acao, versao_texto into v_acao, v_versao
    from public.consentimentos
   where usuario_id = new.usuario_id and finalidade = '3b_indenizacao'
   order by criado_em desc, id desc
   limit 1;
  if v_acao is distinct from 'aceitou' then
    raise exception 'sem consentimento para a 3B' using errcode = 'P0001';
  end if;
  new.versao_consentimento := v_versao;
  return new;
end;
$$;

drop trigger if exists corre_leads_proteger on public.leads_parceiros;
create trigger corre_leads_proteger
  before insert on public.leads_parceiros
  for each row execute function public.corre_leads_proteger();

alter table public.leads_parceiros enable row level security;
drop policy if exists corre_leads_ler on public.leads_parceiros;
create policy corre_leads_ler on public.leads_parceiros
  for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists corre_leads_inserir on public.leads_parceiros;
create policy corre_leads_inserir on public.leads_parceiros
  for insert to authenticated with check (usuario_id = (select auth.uid()));

revoke all on public.consentimentos, public.leads_parceiros from anon;
revoke update, delete, truncate on public.consentimentos, public.leads_parceiros from authenticated;
grant select, insert on public.consentimentos, public.leads_parceiros to authenticated;
