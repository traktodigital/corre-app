-- Simula o Supabase (papéis, auth.uid/jwt) com políticas ABERTAS (pior caso).
-- Uso: ver docs/backend/teste/README.md. NUNCA rodar em produção.
-- Imita o Supabase: papéis, auth.uid()/jwt(), authenticator NOINHERIT.
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create role authenticator login noinherit;
exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;
create schema auth; grant usage on schema auth to anon, authenticated;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated;

create extension if not exists pgcrypto;
create table tokens_carteirinha (token text primary key, associado_id uuid, expira_em timestamptz, criado_em timestamptz default now());
create table associacoes (id uuid primary key, sigla text, ativa bool default true);
create table usuarios (id uuid primary key, nome text, email text, cpf text, telefone text, foto_url text, placa text,
  plano text default 'free', status text default 'ativo');
create table papeis_usuario (id serial primary key, usuario_id uuid, papel text, associacao_id uuid, parceiro_id uuid, contratante_id uuid);
create table associados (id serial primary key, usuario_id uuid, associacao_id uuid, status text);
create table solicitacoes_filiacao (id serial primary key, usuario_id uuid, associacao_id uuid, status text,
  nome text, cpf text, telefone text, placa text);
create table parceiros (id uuid primary key, plano text, status text default 'ativo');
create table ofertas (id uuid primary key, parceiro_id uuid, status text default 'ativa', tipo text default 'desconto_fixo',
  exclusivo_associados bool default false, exclusivo_premium bool default false,
  limite_por_usuario int, limite_total int, validade_inicio date, validade_fim date,
  valor_desconto numeric, preco_de numeric, preco_por numeric);
create type status_resgate as enum ('gerado','validado','expirado','cancelado');
create table resgates (id serial primary key, usuario_id uuid, parceiro_id uuid, oferta_id uuid,
  codigo text not null unique, gerado_em timestamptz default now(), status status_resgate default 'gerado',
  validado_em timestamptz, validado_por uuid, valor_economizado numeric);

-- Bug atual reproduzido: anon sem EXECUTE na função usada pela política.
create function eh_admin_associacao(_id uuid) returns bool language sql stable security definer
  set search_path = public as $$ select false $$;
revoke all on function eh_admin_associacao(uuid) from public;
grant execute on function eh_admin_associacao(uuid) to authenticated;

-- PIOR CASO: políticas permissivas abertas em tudo.
do $$ declare t text; begin
  foreach t in array array['associacoes','usuarios','papeis_usuario','associados','solicitacoes_filiacao','resgates','parceiros','ofertas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant all on %I to anon, authenticated', t);
    execute format('create policy aberta on %I for all to authenticated using (true) with check (true)', t);
  end loop; end $$;
create policy leitura_anon on associacoes for select to anon using (ativa or eh_admin_associacao(id));
grant usage on all sequences in schema public to authenticated;

-- A, B entregadores (X, Y); ADMX admin da X; T admin_trakto.
insert into associacoes values ('00000000-0000-0000-0000-00000000000a','ASSEMAG'),('00000000-0000-0000-0000-00000000000b','OUTRA');
insert into usuarios (id, nome) values
 ('00000000-0000-0000-0000-0000000000a1','A'),('00000000-0000-0000-0000-0000000000b1','B'),
 ('00000000-0000-0000-0000-0000000000ad','ADMX'),('00000000-0000-0000-0000-0000000000c1','P'),('00000000-0000-0000-0000-0000000000f1','T');
insert into papeis_usuario (usuario_id, papel, associacao_id) values
 ('00000000-0000-0000-0000-0000000000a1','entregador','00000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-0000000000b1','entregador','00000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-0000000000ad','admin_associacao','00000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-0000000000f1','admin_trakto',null);
insert into papeis_usuario (usuario_id, papel, parceiro_id) values
 ('00000000-0000-0000-0000-0000000000c1','parceiro','00000000-0000-0000-0000-0000000000e1');
insert into associados (usuario_id, associacao_id, status) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000000a','ativo'),
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000000b','ativo');
insert into solicitacoes_filiacao (usuario_id, associacao_id, status) values
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000000b','pendente');
-- Parceiro e1 (plano avulso → R$1,50), e2 (plano 'destaque', sem tarifa mapeada).
insert into parceiros (id, plano) values
 ('00000000-0000-0000-0000-0000000000e1','gratuito'),('00000000-0000-0000-0000-0000000000e2','destaque');
insert into ofertas (id, parceiro_id, preco_de, preco_por, status, validade_fim, exclusivo_premium, limite_total) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',null,null,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000e2',20,15,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,false,null),
 ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000e2',null,null,'pausada',null,false,null),
 ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',current_date - 1,false,null),
 ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,true,null),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000e2',null,null,'ativa',null,false,1);
-- 4 é um código VENCIDO de A na mesma oferta de 1: a migration precisa fechar
-- ele antes de criar o índice "um aberto por usuário+oferta".
insert into resgates (id, usuario_id, parceiro_id, oferta_id, codigo, gerado_em, status) values
 (5,'00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000f5','CC-ESGO',now() - interval '1 day','validado');
insert into resgates (id, usuario_id, parceiro_id, oferta_id, codigo, gerado_em) values
 (1,'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','CC-AAAA',now()),
 (2,'00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000d2','CC-BBBB',now()),
 (3,'00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','CC-CCCC',now()),
 (4,'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','CC-VELH',now() - interval '20 minutes');
select setval('resgates_id_seq', 1000);

-- Roda um comando e devolve 'erro: ...' ou o nº de linhas afetadas.
create function t(_sql text) returns text language plpgsql as $$
declare n bigint; begin execute _sql; get diagnostics n = row_count; return n::text;
exception when others then return 'erro: ' || sqlerrm; end $$;
grant execute on function t(text) to anon, authenticated;
