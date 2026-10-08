-- Fluxo de aprovação de filiação iniciado pelo app mobile.
-- Aplicar como migration no projeto Supabase do backend, após revisar o schema.
-- A aprovação é transacional: perfil, associado, papel por associação e status
-- da solicitação são gravados juntos. A função exige admin_associacao do tenant.

create or replace function public.aprovar_solicitacao_filiacao(
  _solicitacao_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s record;
  v_seq bigint;
begin
  if auth.uid() is null then
    raise exception 'filiação: autenticação necessária' using errcode = '42501';
  end if;

  select id, usuario_id, associacao_id, status::text as status,
         nome, cpf, telefone, cidade, uf, tipo_veiculo, placa
    into s
    from public.solicitacoes_filiacao
   where id = _solicitacao_id
   for update;

  if not found then
    raise exception 'filiação: pedido não encontrado' using errcode = 'P0001';
  end if;
  if not public.corre_admin_da_associacao(s.associacao_id) then
    raise exception 'filiação: sem permissão para esta associação'
      using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'filiação: pedido já analisado' using errcode = 'P0001';
  end if;

  -- Serializa pedidos simultâneos da mesma pessoa para a mesma associação.
  perform pg_advisory_xact_lock(
    hashtext(s.usuario_id::text || ':' || s.associacao_id::text)
  );

  -- Vínculo já existe (pedido duplicado ou criado pelo painel web): fecha este
  -- pedido e os irmãos pendentes em vez de travar a fila do admin.
  -- Não reativa vínculo cancelado/inadimplente: isso segue pelo painel web.
  if exists (
    select 1 from public.associados
     where usuario_id = s.usuario_id and associacao_id = s.associacao_id
  ) then
    update public.solicitacoes_filiacao
       set status = 'aprovada', observacao = null
     where usuario_id = s.usuario_id
       and associacao_id = s.associacao_id
       and status::text = 'pendente';
    return;
  end if;

  insert into public.usuarios
    (id, nome, cpf, telefone, cidade, uf, tipo_veiculo, placa)
  values
    (s.usuario_id, s.nome, s.cpf, s.telefone, s.cidade, s.uf,
     s.tipo_veiculo, s.placa)
  on conflict (id) do update set
    nome = excluded.nome,
    cpf = excluded.cpf,
    telefone = excluded.telefone,
    cidade = excluded.cidade,
    uf = excluded.uf,
    tipo_veiculo = excluded.tipo_veiculo,
    placa = excluded.placa;

  -- numero_carteirinha é NOT NULL sem default: sequencial por associação
  -- (000001, 000002...). A trava serializa aprovações simultâneas do tenant.
  -- ponytail: max()+1 sob lock; sequence por associação se o volume crescer.
  perform pg_advisory_xact_lock(hashtext('carteirinha:' || s.associacao_id::text));
  select coalesce(max(nullif(regexp_replace(numero_carteirinha, '\D', '', 'g'), '')::bigint), 0) + 1
    into v_seq
    from public.associados
   where associacao_id = s.associacao_id;

  insert into public.associados
    (usuario_id, associacao_id, status, numero_carteirinha)
  values
    (s.usuario_id, s.associacao_id, 'ativo', lpad(v_seq::text, 6, '0'));

  if not exists (
    select 1 from public.papeis_usuario
     where usuario_id = s.usuario_id
       and papel::text = 'entregador'
       and associacao_id = s.associacao_id
  ) then
    insert into public.papeis_usuario (usuario_id, papel, associacao_id)
    values (s.usuario_id, 'entregador', s.associacao_id);
  end if;

  -- Fecha também pedidos duplicados da mesma pessoa para a mesma associação.
  update public.solicitacoes_filiacao
     set status = 'aprovada', observacao = null
   where usuario_id = s.usuario_id
     and associacao_id = s.associacao_id
     and status::text = 'pendente';
end;
$$;

create or replace function public.rejeitar_solicitacao_filiacao(
  _solicitacao_id uuid,
  _observacao text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  s record;
begin
  if auth.uid() is null then
    raise exception 'filiação: autenticação necessária' using errcode = '42501';
  end if;
  if length(trim(coalesce(_observacao, ''))) < 5 then
    raise exception 'filiação: informe o motivo da recusa' using errcode = 'P0001';
  end if;

  select id, associacao_id, status::text as status
    into s
    from public.solicitacoes_filiacao
   where id = _solicitacao_id
   for update;

  if not found then
    raise exception 'filiação: pedido não encontrado' using errcode = 'P0001';
  end if;
  if not public.corre_admin_da_associacao(s.associacao_id) then
    raise exception 'filiação: sem permissão para esta associação'
      using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'filiação: pedido já analisado' using errcode = 'P0001';
  end if;

  update public.solicitacoes_filiacao
     set status = 'rejeitada', observacao = left(trim(_observacao), 500)
   where id = s.id and status::text = 'pendente';
end;
$$;

revoke all on function public.aprovar_solicitacao_filiacao(uuid)
  from public, anon;
revoke all on function public.rejeitar_solicitacao_filiacao(uuid, text)
  from public, anon;
grant execute on function public.aprovar_solicitacao_filiacao(uuid)
  to authenticated;
grant execute on function public.rejeitar_solicitacao_filiacao(uuid, text)
  to authenticated;
