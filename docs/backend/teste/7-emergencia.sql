-- Botão de emergência (partes/10-emergencia.sql). Toda linha deve começar com OK.
-- Rodar conectado como `authenticator`, depois das partes 8 e 10.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'
\set E1 '22222222-0000-0000-0000-000000000001'
create temp table ok (n serial, caso text, passou bool);
grant all on ok to authenticated, anon;
grant usage on sequence ok_n_seq to authenticated, anon;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);

insert into ok (caso, passou) values
('contato de emergência cadastrado (dono forjado vira o próprio usuário)',
   t($$insert into contatos_emergencia (usuario_id, nome, telefone) values ('$$ || :'B' || $$', 'Maria', '62999990000')$$) = '1'),
('telefone com letra ou curto é recusado',
   t($$update contatos_emergencia set telefone = '123' $$) like 'erro%'),
('nome vazio é recusado',
   t($$update contatos_emergencia set nome = '   ' $$) like 'erro%'),
('trocar o contato',
   t($$update contatos_emergencia set nome = 'Mãe', telefone = '62988887777'$$) = '1'),
('acionar com localização (horário forjado vira o do servidor)',
   t($$insert into emergencia_eventos (emergencia_id, tipo, lat, lng, precisao_m, criado_em) values ('$$ || :'E1' || $$', 'acionou', -16.68, -49.25, 8, now() - interval '5 days')$$) = '1'),
('ligar 192 na mesma emergência',
   t($$insert into emergencia_eventos (emergencia_id, tipo) values ('$$ || :'E1' || $$', 'ligou_192')$$) = '1'),
('evento solto, sem acionamento antes, é recusado',
   t($$insert into emergencia_eventos (emergencia_id, tipo) values (gen_random_uuid(), 'encerrou')$$) like 'erro%'),
('tipo de evento inválido',
   t($$insert into emergencia_eventos (emergencia_id, tipo) values ('$$ || :'E1' || $$', 'brincadeira')$$) like 'erro%'),
('latitude sem longitude é recusada',
   t($$insert into emergencia_eventos (tipo, lat) values ('acionou', -16.68)$$) like 'erro%'),
('evento não pode ser editado (append-only)',
   t($$update emergencia_eventos set tipo = 'encerrou'$$) like 'erro%'),
('evento não pode ser apagado (append-only)',
   t($$delete from emergencia_eventos$$) like 'erro%');

insert into ok (caso, passou) values
('contato gravado em nome de A',
   coalesce((select usuario_id = :'A' and nome = 'Mãe' from contatos_emergencia), false)),
('horário do acionamento é do servidor',
   coalesce((select criado_em > now() - interval '1 minute' from emergencia_eventos where tipo = 'acionou'), false)),
('dois eventos na emergência de A',
   (select count(*) = 2 from emergencia_eventos where emergencia_id = :'E1'));

select set_config('request.jwt.claims', '{"sub":"' || :'B' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('B não vê o contato de A', (select count(*) = 0 from contatos_emergencia)),
('B não vê os eventos de A', (select count(*) = 0 from emergencia_eventos)),
('B não troca o contato de A', t($$update contatos_emergencia set nome = 'x'$$) = '0'),
('B não pendura evento na emergência de A',
   t($$insert into emergencia_eventos (emergencia_id, tipo) values ('$$ || :'E1' || $$', 'encerrou')$$) like 'erro%');

reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into ok (caso, passou) values
('anônimo não lê contatos', t($$select * from contatos_emergencia$$) like 'erro%'),
('anônimo não aciona emergência', t($$insert into emergencia_eventos (tipo) values ('acionou')$$) like 'erro%');

reset role;
select format('%-5s %s', case when passou then 'OK' else 'FALHA' end, caso) from ok order by n;

\c - postgres
\set QUIET on
select corre_anonimizar_dados(:'A');
select format('%-5s %s', case when ok then 'OK' else 'FALHA' end, caso) from (values
  ('exclusão apaga o contato de emergência', (select count(*) = 0 from contatos_emergencia where usuario_id = :'A')),
  ('exclusão apaga os eventos de emergência', (select count(*) = 0 from emergencia_eventos where usuario_id = :'A'))
) v(caso, ok);
