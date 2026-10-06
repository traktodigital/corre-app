-- Desfaz as TRAVAS de seguranca-fase1.sql (políticas, triggers, funções).
-- Mantém os dados e as tabelas novas (tarifas_ativacao, tentativas_validacao,
-- resgates_estornos) e as colunas novas de resgates — nada se perde.
-- NÃO recria o UNIQUE global de resgates.codigo (pode haver códigos repetidos
-- entre resgates fechados); o índice parcial corre_resgates_codigo_aberto fica.
begin;

drop policy if exists corre_trava_papeis_insert on public.papeis_usuario;
drop policy if exists corre_trava_papeis_update on public.papeis_usuario;
drop policy if exists corre_trava_papeis_delete on public.papeis_usuario;
drop policy if exists corre_trava_resgates_delete on public.resgates;
drop policy if exists corre_trava_resgates_select on public.resgates;
drop policy if exists corre_trava_resgates_update on public.resgates;
drop policy if exists corre_trava_resgates_insert on public.resgates;
drop policy if exists corre_trava_usuarios_proprio on public.usuarios;
drop policy if exists corre_trava_usuarios_delete on public.usuarios;
drop policy if exists corre_trava_associados on public.associados;
drop policy if exists corre_trava_filiacao_leitura on public.solicitacoes_filiacao;
drop policy if exists corre_trava_filiacao_insert on public.solicitacoes_filiacao;
drop policy if exists corre_trava_filiacao_update on public.solicitacoes_filiacao;

drop trigger if exists corre_resgates_antes_inserir on public.resgates;
drop trigger if exists corre_resgates_proteger on public.resgates;
drop trigger if exists corre_usuarios_ao_criar on public.usuarios;
drop trigger if exists corre_usuarios_proteger on public.usuarios;
drop trigger if exists corre_parceiros_proteger on public.parceiros;

drop index if exists public.corre_resgates_um_aberto;

-- Funções de negócio novas ficam (validar_resgate, estornar_resgate,
-- corre_anonimizar_usuario): sem trigger/política elas só fazem o que fazem.
-- gerar_token_carteirinha volta à versão original (aceita desligado):
create or replace function public.gerar_token_carteirinha(_associado_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare v_token text;
begin
  if not exists (
    select 1 from public.associados a
     where a.id = _associado_id and a.usuario_id = auth.uid()
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

commit;
