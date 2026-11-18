-- Rota da 3B atrás de flag (partes/11-rota-3b.sql). Toda linha deve começar com OK.
-- Rodar conectado como `authenticator`, depois da parte 11.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'

create temp table ok (n serial, caso text, passou bool);
grant all on ok to authenticated, anon;
grant usage on sequence ok_n_seq to authenticated, anon;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('flag da 3B nasce desligada',
   coalesce((select not ligada from app_flags where chave = 'rota_3b'), false)),
('entregador não liga a flag',
   t($$update app_flags set ligada = true$$) like 'erro%'),
('flag desligada: consentir é recusado pelo banco',
   t($$insert into consentimentos (finalidade, acao, versao_texto) values ('3b_indenizacao', 'aceitou', 'v1')$$) like 'erro%'),
('flag desligada: lead é recusado pelo banco',
   t($$insert into leads_parceiros (parceiro) values ('3b')$$) like 'erro%'),
('revogar é sempre permitido',
   t($$insert into consentimentos (finalidade, acao, versao_texto) values ('3b_indenizacao', 'revogou', 'v1')$$) = '1');
reset role;
select format('%-5s %s', case when passou then 'OK' else 'FALHA' end, caso) from ok order by n;

\c - postgres
\set QUIET on
update public.app_flags set ligada = true where chave = 'rota_3b';

\c - authenticator
\set QUIET on
\set A '00000000-0000-0000-0000-0000000000a1'
\set B '00000000-0000-0000-0000-0000000000b1'
create temp table ok (n serial, caso text, passou bool);
grant all on ok to authenticated, anon;
grant usage on sequence ok_n_seq to authenticated, anon;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('lead sem consentimento vigente é recusado',
   t($$insert into leads_parceiros (parceiro) values ('3b')$$) like 'erro%');
insert into ok (caso, passou) values
('flag ligada: consentir (dono e horário forjados viram os do servidor)',
   t($$insert into consentimentos (usuario_id, finalidade, acao, versao_texto, criado_em) values ('$$ || :'B' || $$', '3b_indenizacao', 'aceitou', 'v2', now() + interval '1 day')$$) = '1');
insert into ok (caso, passou) values
('lead depois de consentir', t($$insert into leads_parceiros (parceiro) values ('3b')$$) = '1');
insert into ok (caso, passou) values
('consentimento gravado em nome de A, com horário do servidor',
   coalesce((select usuario_id = :'A' and criado_em <= now() from consentimentos where acao = 'aceitou'), false)),
('lead guarda a versão do consentimento aceito',
   coalesce((select versao_consentimento = '3b-2026-11-17-provisorio' from leads_parceiros), false)),
('versão do texto vem do servidor (a "v2" do app é ignorada)',
   coalesce((select versao_texto = '3b-2026-11-17-provisorio' from consentimentos where acao = 'aceitou'), false)),
('entregador lê o texto vigente', (select count(*) = 1 from textos_consentimento)),
('entregador não altera o texto de consentimento',
   t($$update textos_consentimento set texto = 'qualquer coisa que eu quiser aqui'$$) like 'erro%'),
('consentimento não pode ser editado',
   t($$update consentimentos set acao = 'aceitou'$$) like 'erro%'),
('lead não pode ser apagado',
   t($$delete from leads_parceiros$$) like 'erro%'),
('finalidade inválida',
   t($$insert into consentimentos (finalidade, acao, versao_texto) values ('marketing', 'aceitou', 'v2')$$) like 'erro%'),
('parceiro inválido',
   t($$insert into leads_parceiros (parceiro) values ('outro')$$) like 'erro%');
insert into ok (caso, passou) values
('revogar depois de aceitar',
   t($$insert into consentimentos (finalidade, acao, versao_texto) values ('3b_indenizacao', 'revogou', 'v2')$$) = '1');
insert into ok (caso, passou) values
('depois de revogar, lead volta a ser recusado',
   t($$insert into leads_parceiros (parceiro) values ('3b')$$) like 'erro%');

select set_config('request.jwt.claims', '{"sub":"' || :'B' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('B não vê consentimentos de A', (select count(*) = 0 from consentimentos)),
('B não vê leads de A', (select count(*) = 0 from leads_parceiros));

reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into ok (caso, passou) values
('anônimo não lê o texto de consentimento', t($$select * from textos_consentimento$$) like 'erro%'),
('anônimo lê a flag', t($$select * from app_flags where chave = 'rota_3b'$$) = '1'),
('anônimo não consente',
   t($$insert into consentimentos (finalidade, acao, versao_texto) values ('3b_indenizacao', 'aceitou', 'v2')$$) like 'erro%');
reset role;
select format('%-5s %s', case when passou then 'OK' else 'FALHA' end, caso) from ok order by n;

\c - postgres
\set QUIET on
update public.app_flags set ligada = false where chave = 'rota_3b';
select format('%-5s %s', case when ok then 'OK' else 'FALHA' end, caso) from (values
  ('relatório do dia 10 traz o lead de A',
   (select count(*) = 1 from leads_parceiros l where l.parceiro = '3b')),
  ('flag volta a ficar desligada',
   (select not ligada from app_flags where chave = 'rota_3b'))
) v(caso, ok);
