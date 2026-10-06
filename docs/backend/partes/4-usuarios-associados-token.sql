-- Parte 4/5 de seguranca-fase1.sql — rodar NA ORDEM, uma por vez.
begin;

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
  v_token := encode(gen_random_bytes(24), 'hex');
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

commit;
