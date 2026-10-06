-- (sem begin/commit: cada comando é idempotente, pode rodar de novo)
-- Parte 5/5 de seguranca-fase1.sql — rodar NA ORDEM, uma por vez.

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
