-- Exclusão de conta pelo app (partes/7). Rodar como postgres, depois do 3.
-- Todas as linhas devem sair OK.
\set QUIET on
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'

-- Stub mínimo das tabelas do GoTrue que a função toca.
create table if not exists auth.users (id uuid primary key, email text, phone text,
  encrypted_password text, raw_user_meta_data jsonb, banned_until timestamptz);
create table if not exists auth.identities (id serial, user_id uuid);
create table if not exists auth.sessions (id serial, user_id uuid);
insert into auth.users values
  (:'A', 'a@x.com', '+5562', 'hash', '{"nome":"A"}', null),
  (:'B', 'b@x.com', '+5563', 'hash', '{"nome":"B"}', null);
insert into auth.identities (user_id) values (:'A'), (:'B');
insert into auth.sessions (user_id) values (:'A'), (:'B');
update usuarios set email = 'b@x.com', cpf = '123', telefone = '9' where id = :'B';

\i ../partes/7-excluir-minha-conta.sql

create temp table r (caso text, ok bool);
grant all on r to anon, authenticated;

-- anon não chega na função
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin
  perform excluir_minha_conta();
  insert into r values ('anon não exclui', false);
exception when others then insert into r values ('anon não exclui', true); end $$;

-- app não chama o núcleo sem checagem direto
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);
do $$ begin
  perform corre_anonimizar_dados('00000000-0000-0000-0000-0000000000b1');
  insert into r values ('núcleo fechado pro app', false);
exception when others then insert into r values ('núcleo fechado pro app', true); end $$;

-- B exclui a própria conta
select set_config('request.jwt.claims', '{"sub":"' || :'B' || '","role":"authenticated"}', false);
select excluir_minha_conta();
reset role;

insert into r values
  ('B: dados pessoais apagados',
   (select nome = 'Conta excluída' and email is null and cpf is null and telefone is null
      from usuarios where id = :'B')),
  ('B: resgates mantidos, nenhum aberto',
   (select count(*) > 0 and count(*) filter (where status = 'gerado') = 0
      from resgates where usuario_id = :'B')),
  ('B: desligado da associação',
   (select bool_and(status = 'desligado') from associados where usuario_id = :'B')),
  ('B: sem papéis', (select count(*) = 0 from papeis_usuario where usuario_id = :'B')),
  ('B: auth banido, e-mail trocado, sem senha',
   (select banned_until > now() + interval '50 years'
       and email = id || '@conta-excluida.invalid'
       and phone is null and encrypted_password = '' and raw_user_meta_data = '{}'
      from auth.users where id = :'B')),
  ('B: sem identidades nem sessões',
   (select (select count(*) from auth.identities where user_id = :'B')
         + (select count(*) from auth.sessions where user_id = :'B') = 0)),
  ('A intacto no auth',
   (select email = 'a@x.com' and banned_until is null from auth.users where id = :'A')),
  ('backend ainda anonimiza (parte 5)',
   (select prosrc like '%corre_anonimizar_dados%' from pg_proc
     where proname = 'corre_anonimizar_usuario'));

select format('%-5s %s', case when ok then 'OK' else 'FALHA' end, caso) from r;
