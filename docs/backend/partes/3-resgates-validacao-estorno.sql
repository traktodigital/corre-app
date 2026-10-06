-- Parte 3/5 de seguranca-fase1.sql — rodar NA ORDEM, uma por vez.
begin;

-- 3f. Resgate nunca é apagado (auditoria, funil, cobrança).
drop policy if exists corre_trava_resgates_delete on public.resgates;
create policy corre_trava_resgates_delete on public.resgates
  as restrictive for delete to authenticated
  using (false);

-- 3g. Leitura: dono, parceiro do resgate, admin da associação do entregador.
drop policy if exists corre_trava_resgates_select on public.resgates;
create policy corre_trava_resgates_select on public.resgates
  as restrictive for select to authenticated
  using (usuario_id = auth.uid()
         or public.corre_parceiro_de(parceiro_id)
         or public.corre_admin_do_usuario(usuario_id));

-- 3h. UPDATE direto: só o dono (cancelar) ou admin_trakto. O parceiro valida
-- SÓ por validar_resgate() — UPDATE direto pularia o limite de tentativas.
drop policy if exists corre_trava_resgates_update on public.resgates;
create policy corre_trava_resgates_update on public.resgates
  as restrictive for update to authenticated
  using (usuario_id = auth.uid() or public.corre_tem_papel('admin_trakto'))
  with check (usuario_id = auth.uid() or public.corre_tem_papel('admin_trakto'));

-- 3i. Insert só em nome próprio.
drop policy if exists corre_trava_resgates_insert on public.resgates;
create policy corre_trava_resgates_insert on public.resgates
  as restrictive for insert to authenticated
  with check (usuario_id = auth.uid());

-- 3j. Validação no balcão: rate limit + log de TODA tentativa.
create table if not exists public.tentativas_validacao (
  id bigint generated always as identity primary key,
  parceiro_id uuid not null,
  usuario_id uuid not null,
  codigo_digitado text not null,
  resgate_id text,  -- texto: independe do tipo de resgates.id
  resultado text not null,  -- ok | codigo_invalido | bloqueado
  criado_em timestamptz not null default now()
);
create index if not exists corre_tentativas_usuario_idx
  on public.tentativas_validacao (usuario_id, criado_em desc);
alter table public.tentativas_validacao enable row level security;
drop policy if exists corre_tentativas_leitura on public.tentativas_validacao;
create policy corre_tentativas_leitura on public.tentativas_validacao
  for select to authenticated using (public.corre_tem_papel('admin_trakto'));

create or replace function public.validar_resgate(_codigo text, _parceiro_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cod text := upper(trim(_codigo));
  v_erros_min int;
  v_erros_hora int;
  v_id text;
begin
  if v_uid is null or not public.corre_parceiro_de(_parceiro_id) then
    raise exception 'validar_resgate: sem permissão' using errcode = '42501';
  end if;

  -- Bloqueio progressivo: 5 erros/min ou 20/hora. Tentativa bloqueada também
  -- conta, então insistir estende o bloqueio sozinho.
  select count(*) filter (where criado_em > now() - interval '1 minute'),
         count(*)
    into v_erros_min, v_erros_hora
    from public.tentativas_validacao
   where usuario_id = v_uid and resultado <> 'ok'
     and criado_em > now() - interval '1 hour';

  if v_erros_min >= 5 or v_erros_hora >= 20 then
    insert into public.tentativas_validacao
      (parceiro_id, usuario_id, codigo_digitado, resultado)
    values (_parceiro_id, v_uid, v_cod, 'bloqueado');
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
  end if;

  -- Código sozinho não basta: precisa ser deste parceiro, oferta ativa,
  -- aberto e dentro dos 15 min.
  update public.resgates r set status = 'validado'
    from public.ofertas o
   where r.codigo = v_cod
     and r.parceiro_id = _parceiro_id
     and r.status = 'gerado'
     and r.gerado_em >= now() - interval '15 minutes'
     and o.id = r.oferta_id and o.status = 'ativa'
  returning r.id::text into v_id;

  insert into public.tentativas_validacao
    (parceiro_id, usuario_id, codigo_digitado, resgate_id, resultado)
  values (_parceiro_id, v_uid, v_cod, v_id,
          case when v_id is null then 'codigo_invalido' else 'ok' end);

  if v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  return jsonb_build_object('ok', true, 'resgate_id', v_id);
end;
$$;

revoke all on function public.validar_resgate(text, uuid) from public, anon;
grant execute on function public.validar_resgate(text, uuid) to authenticated;

-- 3k. Estorno: evento novo (append-only), motivo obrigatório, janela limitada.
create table if not exists public.resgates_estornos (
  id bigint generated always as identity primary key,
  resgate_id text not null unique,  -- um estorno por resgate
  motivo text not null check (length(trim(motivo)) >= 5),
  estornado_por uuid not null,
  criado_em timestamptz not null default now()
);
alter table public.resgates_estornos enable row level security;
drop policy if exists corre_estornos_leitura on public.resgates_estornos;
create policy corre_estornos_leitura on public.resgates_estornos
  for select to authenticated
  using (estornado_por = auth.uid() or public.corre_tem_papel('admin_trakto'));
-- Sem política de insert/update/delete: só estornar_resgate() escreve.

create or replace function public.estornar_resgate(_resgate_id text, _motivo text)
returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  select id, parceiro_id, status, validado_em into r
    from public.resgates where id::text = _resgate_id;
  if not found or not (public.corre_parceiro_de(r.parceiro_id)
                       or public.corre_tem_papel('admin_trakto')) then
    raise exception 'estorno: sem permissão' using errcode = '42501';
  end if;
  if r.status::text <> 'validado' then
    raise exception 'estorno: só resgate validado' using errcode = 'P0001';
  end if;
  -- PENDENTE (negócio): janela máxima. Sugestão validada: mesmo dia.
  if (r.validado_em at time zone 'America/Sao_Paulo')::date
     <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'estorno: fora da janela (mesmo dia)' using errcode = 'P0001';
  end if;
  insert into public.resgates_estornos (resgate_id, motivo, estornado_por)
  values (_resgate_id, trim(_motivo), auth.uid());
end;
$$;

revoke all on function public.estornar_resgate(text, text) from public, anon;
grant execute on function public.estornar_resgate(text, text) to authenticated;

-- Privilégios explícitos (não depender do default do schema): anon não toca;
-- authenticated só lê, e as políticas acima filtram as linhas.
revoke all on public.tarifas_ativacao, public.tentativas_validacao,
  public.resgates_estornos from anon, authenticated;
grant select on public.tarifas_ativacao, public.tentativas_validacao,
  public.resgates_estornos to authenticated;

-- 3l. Fatura do dia 1º: só soma o que já está gravado (não reconsulta plano).
create or replace view public.cobranca_ativacoes
with (security_invoker = true) as
select r.parceiro_id,
       date_trunc('month', r.validado_em at time zone 'America/Sao_Paulo')::date as mes,
       count(*) as ativacoes,
       coalesce(sum(r.tarifa_aplicada), 0) as total,
       count(*) filter (where r.tarifa_aplicada is null) as sem_tarifa
  from public.resgates r
 where r.status = 'validado'
   and not exists (select 1 from public.resgates_estornos e
                    where e.resgate_id = r.id::text)
 group by 1, 2;

revoke all on public.cobranca_ativacoes from anon, authenticated;
grant select on public.cobranca_ativacoes to authenticated;

commit;
