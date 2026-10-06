-- Ataques contra o stub + seguranca-fase1.sql. Todas as linhas devem sair OK.
-- Rodar conectado como `authenticator` (igual ao PostgREST).
\set QUIET on
\pset tuples_only on
\pset format unaligned
create temp table r (n serial, quem text, caso text, esperado text, obtido text);
grant all on r to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;
\set A  '00000000-0000-0000-0000-0000000000a1'
\set B  '00000000-0000-0000-0000-0000000000b1'
\set AD '00000000-0000-0000-0000-0000000000ad'
\set T  '00000000-0000-0000-0000-0000000000f1'
\set P  '00000000-0000-0000-0000-0000000000c1'
\set X  '00000000-0000-0000-0000-00000000000a'
\set E1 '00000000-0000-0000-0000-0000000000e1'
\set E2 '00000000-0000-0000-0000-0000000000e2'
\set D1 '00000000-0000-0000-0000-0000000000d1'
\set D2 '00000000-0000-0000-0000-0000000000d2'

-- ── entregador A
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);
insert into r(quem,caso,esperado,obtido) values
('A','se dar admin_trakto','erro', t($$insert into papeis_usuario(usuario_id,papel) values ('$$||:'A'||$$','admin_trakto')$$)),
('A','criar próprio papel entregador','1', t($$insert into papeis_usuario(usuario_id,papel) values ('$$||:'A'||$$','entregador')$$)),
('A','se vincular à associação sozinho','erro', t($$insert into papeis_usuario(usuario_id,papel,associacao_id) values ('$$||:'A'||$$','entregador','$$||:'X'||$$')$$)),
('A','apagar a própria conta (DELETE)','0', t($$delete from usuarios where id='$$||:'A'||$$'$$)),
('A','criar papel entregador p/ B','erro', t($$insert into papeis_usuario(usuario_id,papel) values ('$$||:'B'||$$','entregador')$$)),
('A','promover próprio papel (update)','0', t($$update papeis_usuario set papel='admin_trakto' where usuario_id='$$||:'A'||$$'$$)),
('A','apagar papéis','0', t($$delete from papeis_usuario$$)),
('A','ver usuarios (só o próprio)','1', t($$select from usuarios$$)),
('A','editar nome de B','0', t($$update usuarios set nome='x' where id='$$||:'B'||$$'$$)),
('A','virar premium','erro', t($$update usuarios set plano='premium' where id='$$||:'A'||$$'$$)),
('A','editar próprio nome','1', t($$update usuarios set nome='A2' where id='$$||:'A'||$$'$$)),
('A','validar o próprio resgate','erro', t($$update resgates set status='validado' where id=1$$)),
('A','mexer no valor economizado','erro', t($$update resgates set valor_economizado=999 where id=1$$)),
('A','trocar código do resgate','erro', t($$update resgates set codigo='CC-ZZZZ' where id=1$$)),
('A','forjar validado_em sem validar','erro', t($$update resgates set validado_em=now() where id=1$$)),
('A','apagar resgate','0', t($$delete from resgates$$)),
('A','ver resgates de B','0', t($$select from resgates where usuario_id='$$||:'B'||$$'$$)),
('A','resgatar em nome de B','erro', t($$insert into resgates(usuario_id,parceiro_id,oferta_id,codigo) values ('$$||:'B'||$$','$$||:'E2'||$$','$$||:'D2'||$$','CC-X1')$$)),
('A','oferta pausada','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000f2','x')$$)),
('A','oferta vencida','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000f3','x')$$)),
('A','oferta premium sendo free','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000f4','x')$$)),
('A','oferta esgotada (limite_total)','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000f5','x')$$)),
('A','oferta que não existe','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$',gen_random_uuid(),'x')$$)),
('A','resgatar (parceiro_id forjado)','1', t($$insert into resgates(id,usuario_id,parceiro_id,oferta_id,codigo,status) values (20,'$$||:'A'||$$','$$||:'E1'||$$','$$||:'D2'||$$','CC-X2','validado')$$)),
('A','servidor define código/status/parceiro/valor','1', t($$select from resgates where id=20 and codigo <> 'CC-X2' and codigo ~ '^CC-[A-HJ-NP-Z2-9]{4}$' and status='gerado' and validado_em is null and parceiro_id='$$||:'E2'||$$' and valor_economizado=5$$)),
('A','2º código aberto na mesma oferta','erro', t($$insert into resgates(usuario_id,parceiro_id,oferta_id,codigo) values ('$$||:'A'||$$','$$||:'E1'||$$','$$||:'D1'||$$','CC-X3')$$)),
('A','cancelar o próprio código','1', t($$update resgates set status='cancelado' where id=20$$)),
('A','reabrir código cancelado','erro', t($$update resgates set status='gerado' where id=20$$)),
('A','gerar código (3º no minuto)','1', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000d3','x')$$)),
('A','gerar código (4º no minuto)','1', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000d4','x')$$)),
('A','gerar código (5º no minuto)','1', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000d5','x')$$)),
('A','gerar código (6º: rate limit)','erro', t($$insert into resgates(usuario_id,oferta_id,codigo) values ('$$||:'A'||$$','00000000-0000-0000-0000-0000000000d6','x')$$)),
('A','ver associados (só o próprio)','1', t($$select from associados$$)),
('A','se filiar direto (associados)','erro', t($$insert into associados(usuario_id,associacao_id,status) values ('$$||:'A'||$$','$$||:'X'||$$','ativo')$$)),
('A','se reativar (associados)','erro', t($$update associados set status='ativo' where usuario_id='$$||:'A'||$$'$$)),
('A','pedir filiação já aprovada','erro', t($$insert into solicitacoes_filiacao(usuario_id,associacao_id,status) values ('$$||:'A'||$$','$$||:'X'||$$','aprovada')$$)),
('A','pedir filiação pendente','1', t($$insert into solicitacoes_filiacao(usuario_id,associacao_id,status) values ('$$||:'A'||$$','$$||:'X'||$$','pendente')$$)),
('A','ver filiação de B','0', t($$select from solicitacoes_filiacao where usuario_id='$$||:'B'||$$'$$)),
('A','aprovar a própria filiação','0', t($$update solicitacoes_filiacao set status='aprovada' where usuario_id='$$||:'A'||$$'$$)),
('A','validar código como parceiro','erro', t($$select validar_resgate('CC-CCCC','$$||:'E1'||$$')$$)),
('A','estornar resgate','erro', t($$select estornar_resgate('1','motivo qualquer')$$)),
('A','anonimizar alguém pelo app','erro', t($$select corre_anonimizar_usuario('$$||:'B'||$$')$$));

-- ── usuário novo N: nasce free mesmo pedindo premium
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
insert into r(quem,caso,esperado,obtido) values
('N','criar perfil já premium','1', t($$insert into usuarios(id,nome,plano,status) values ('00000000-0000-0000-0000-0000000000a2','N','premium','ativo')$$)),
('N','... mas nasce free','1', t($$select from usuarios where id='00000000-0000-0000-0000-0000000000a2' and plano='free'$$));

-- ── admin da associação X
select set_config('request.jwt.claims', '{"sub":"' || :'AD' || '","role":"authenticated"}', false);
insert into r(quem,caso,esperado,obtido) values
('ADMX','ver resgates de fora da X','0', t($$select from resgates where usuario_id <> '$$||:'A'||$$'$$)),
('ADMX','ver usuarios (ele + A)','2', t($$select from usuarios$$)),
('ADMX','ver associados (só X)','1', t($$select from associados$$)),
('ADMX','suspender B (outra assoc.)','0', t($$update associados set status='suspenso' where usuario_id='$$||:'B'||$$'$$)),
('ADMX','suspender A (sua assoc.)','1', t($$update associados set status='suspenso' where usuario_id='$$||:'A'||$$'$$)),
('ADMX','ver filiações (só X)','1', t($$select from solicitacoes_filiacao$$)),
('ADMX','se dar admin_trakto','erro', t($$insert into papeis_usuario(usuario_id,papel) values ('$$||:'AD'||$$','admin_trakto')$$)),
('ADMX','dar admin_trakto c/ assoc. X','erro', t($$insert into papeis_usuario(usuario_id,papel,associacao_id) values ('$$||:'AD'||$$','admin_trakto','$$||:'X'||$$')$$)),
('ADMX','promover o próprio papel','erro', t($$update papeis_usuario set papel='admin_trakto' where usuario_id='$$||:'AD'||$$'$$)),
('ADMX','virar parceiro de e1','erro', t($$insert into papeis_usuario(usuario_id,papel,associacao_id,parceiro_id) values ('$$||:'AD'||$$','parceiro','$$||:'X'||$$','$$||:'E1'||$$')$$)),
('ADMX','vincular entregador na X','1', t($$insert into papeis_usuario(usuario_id,papel,associacao_id) values ('$$||:'A'||$$','entregador','$$||:'X'||$$')$$)),
('ADMX','mexer em papel de outra assoc.','0', t($$delete from papeis_usuario where associacao_id <> '$$||:'X'||$$'$$));

-- ── parceiro P (dono do parceiro e1, plano avulso)
select set_config('request.jwt.claims', '{"sub":"' || :'P' || '","role":"authenticated"}', false);
insert into r(quem,caso,esperado,obtido) values
('P','ver resgates de outro parceiro','0', t($$select from resgates where parceiro_id <> '$$||:'E1'||$$'$$)),
('P','validar por UPDATE direto','0', t($$update resgates set status='validado' where id=3$$)),
('P','validar como parceiro e2','erro', t($$select validar_resgate('CC-BBBB','$$||:'E2'||$$')$$)),
('P','código de outro parceiro','1', t($$select 1 where validar_resgate('CC-BBBB','$$||:'E1'||$$')->>'motivo' = 'codigo_invalido'$$)),
('P','código vencido (>15 min)','1', t($$select 1 where validar_resgate('CC-VELH','$$||:'E1'||$$')->>'motivo' = 'codigo_invalido'$$)),
('P','código certo (minúsculo/espaço)','1', t($$select 1 where validar_resgate(' cc-cccc ','$$||:'E1'||$$')->>'ok' = 'true'$$)),
('P','tarifa gratuito→avulso 1,50 gravada','1', t($$select from resgates where id=3 and status='validado' and plano_parceiro='gratuito' and tarifa_aplicada=1.50 and validado_por='$$||:'P'||$$'$$)),
('P','validar o mesmo código de novo','1', t($$select 1 where validar_resgate('CC-CCCC','$$||:'E1'||$$')->>'motivo' = 'codigo_invalido'$$)),
('P','força bruta (4º erro)','1', t($$select 1 where validar_resgate('CC-ZZZ2','$$||:'E1'||$$')->>'motivo' = 'codigo_invalido'$$)),
('P','força bruta (5º erro)','1', t($$select 1 where validar_resgate('CC-ZZZ3','$$||:'E1'||$$')->>'motivo' = 'codigo_invalido'$$)),
('P','bloqueado mesmo com código certo','1', t($$select 1 where validar_resgate('CC-AAAA','$$||:'E1'||$$')->>'motivo' = 'bloqueado'$$)),
('P','estornar sem motivo','erro', t($$select estornar_resgate('3','')$$)),
('P','estornar com motivo','1', t($$select estornar_resgate('3','cliente desistiu da compra')$$)),
('P','estornar de novo','erro', t($$select estornar_resgate('3','cliente desistiu da compra')$$)),
('P','estornar resgate de outro parceiro','erro', t($$select estornar_resgate('2','tentativa indevida')$$)),
('P','baixar a própria tarifa (plano)','erro', t($$update parceiros set plano='premium' where id='$$||:'E1'||$$'$$)),
('P','pausar a própria vitrine','1', t($$update parceiros set status='pausado' where id='$$||:'E1'||$$'$$)),
('P','retomar a vitrine','1', t($$update parceiros set status='ativo' where id='$$||:'E1'||$$'$$)),
('P','se recusado→ativo / encerrar','erro', t($$update parceiros set status='encerrado' where id='$$||:'E1'||$$'$$)),
('P','ver log de tentativas','0', t($$select from tentativas_validacao$$)),
('P','ver usuarios (só a própria linha)','1', t($$select from usuarios$$));

-- ── admin_trakto
select set_config('request.jwt.claims', '{"sub":"' || :'T' || '","role":"authenticated"}', false);
insert into r(quem,caso,esperado,obtido) values
('T','validar resgate de A','1', t($$update resgates set status='validado' where id=1$$)),
('T','trocar código (auditoria)','erro', t($$update resgates set codigo='CC-ZZZZ' where id=1$$)),
('T','desvalidar (validado é final)','erro', t($$update resgates set status='gerado' where id=1$$)),
('T','apagar resgate','0', t($$delete from resgates$$)),
('T','dar papel parceiro','1', t($$insert into papeis_usuario(usuario_id,papel) values ('$$||:'B'||$$','parceiro')$$)),
('T','log: toda tentativa de P gravada','7', t($$select from tentativas_validacao where usuario_id='$$||:'P'||$$'$$)),
('T','cobrança e1: só r1 (r3 estornado)','1', t($$select from cobranca_ativacoes where parceiro_id='$$||:'E1'||$$' and ativacoes=1 and total=1.50$$));

-- ── anônimo
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into r(quem,caso,esperado,obtido) values
('anon','ler associacoes ativas','2', t($$select from associacoes$$)),
('anon','ler usuarios','0', t($$select from usuarios$$)),
('anon','validar código','erro', t($$select validar_resgate('CC-AAAA','$$||:'E1'||$$')$$));
reset role;

select format('%-5s %-4s %-36s esperado=%-5s obtido=%s',
  case when obtido = esperado or (esperado = 'erro' and obtido like 'erro%') then 'OK' else 'FALHA' end,
  quem, caso, esperado, obtido) from r order by n;
