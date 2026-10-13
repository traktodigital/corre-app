-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 7: exclusão de conta pelo próprio app (exigência Google Play + LGPD).
-- Rodar DEPOIS da parte 5 (usa a mesma anonimização).
--
-- O usuário só exclui a si mesmo (auth.uid()); não recebe id por parâmetro.
-- Dados pessoais somem; resgates ficam anonimizados para auditoria (parte 5).
-- No Auth: bane, troca o e-mail e apaga identidades/sessões. Não usa
-- `delete from auth.users` para não depender de FK com cascade em resgates.

-- Núcleo sem checagem de quem chama: só funções security definer o usam.
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
end;
$$;

revoke all on function public.corre_anonimizar_dados(uuid)
  from public, anon, authenticated, service_role;

-- Versão backend (parte 5) passa a usar o núcleo: uma regra só.
create or replace function public.corre_anonimizar_usuario(_usuario_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.corre_eh_backend() then
    raise exception 'anonimizar: só via Edge Function' using errcode = '42501';
  end if;
  perform public.corre_anonimizar_dados(_usuario_id);
end;
$$;

create or replace function public.excluir_minha_conta()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'excluir conta: login necessário' using errcode = '42501';
  end if;

  perform public.corre_anonimizar_dados(_uid);

  -- Login impossível daqui pra frente e e-mail liberado para novo cadastro.
  -- ponytail: 100 anos em vez de 'infinity' — o GoTrue (Go) não lê infinity.
  update auth.users
     set email = _uid || '@conta-excluida.invalid',
         phone = null,
         encrypted_password = '',
         raw_user_meta_data = '{}'::jsonb,
         banned_until = now() + interval '100 years'
   where id = _uid;
  delete from auth.identities where user_id = _uid;
  delete from auth.sessions where user_id = _uid;
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

notify pgrst, 'reload schema';
