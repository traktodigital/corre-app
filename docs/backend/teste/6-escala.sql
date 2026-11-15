-- Melhorias de escala (../partes/9-escala.sql, ADR-0001 M1/M2/M3/M12/M14/M16).
-- Rodar como postgres no fim da suíte (ver README). Toda linha deve sair OK.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\set X  '00000000-0000-0000-0000-00000000000a'
\set AD '00000000-0000-0000-0000-0000000000ad'
\set U1 '00000000-0000-0000-0000-0000000000e5'
\set U2 '00000000-0000-0000-0000-0000000000e6'
\set U3 '00000000-0000-0000-0000-0000000000e7'
\set P3 '00000000-0000-0000-0000-0000000000c3'
\set P4 '00000000-0000-0000-0000-0000000000c4'
\set PZ '00000000-0000-0000-0000-0000000000f9'

create temp table ok (n serial, caso text, passou bool);
grant all on ok to authenticated;
grant usage on sequence ok_n_seq to authenticated;

-- M2
insert into ok (caso, passou) values ('índices da parte 9 criados', (
  select count(*) = 6 from pg_indexes where indexname in (
    'corre_resgates_usuario_gerado_idx', 'corre_resgates_oferta_status_idx',
    'corre_resgates_validados_idx', 'corre_tentativas_parceiro_idx',
    'corre_tokens_expira_idx', 'corre_filiacao_uma_pendente')));

-- M1
update resgates set status = 'gerado', codigo = 'ZZ-TEST', gerado_em = now() - interval '1 hour'
 where id = (select max(id) from resgates);
insert into tokens_carteirinha (token, associado_id, expira_em) values
  ('token-velho', gen_random_uuid(), now() - interval '1 hour'),
  ('token-novo', gen_random_uuid(), now() + interval '1 minute');
select corre_expirar_resgates() as expirados \gset
select corre_limpar_tokens_carteirinha() as limpos \gset
insert into ok (caso, passou) values
('job expira código gerado vencido', :expirados >= 1
   and (select status::text = 'expirado' from resgates where codigo = 'ZZ-TEST')),
('job apaga só token vencido', :limpos >= 1
   and not exists (select 1 from tokens_carteirinha where token = 'token-velho')
   and exists (select 1 from tokens_carteirinha where token = 'token-novo')),
('anônimo/entregador não chamam os jobs',
   not has_function_privilege('authenticated', 'corre_expirar_resgates()', 'execute'));

-- M14: número sequencial sem varrer, acompanhando número criado pelo painel web
insert into associados (usuario_id, associacao_id, status, numero_carteirinha)
values (gen_random_uuid(), :'X', 'ativo', '000050');
insert into solicitacoes_filiacao (usuario_id, associacao_id, status, nome) values
  (:'U1', :'X', 'pendente', 'Um Teste'), (:'U2', :'X', 'pendente', 'Dois Teste');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'AD' || '","role":"authenticated"}', false);
select aprovar_solicitacao_filiacao((select id from solicitacoes_filiacao where usuario_id = :'U1'));
select aprovar_solicitacao_filiacao((select id from solicitacoes_filiacao where usuario_id = :'U2'));
reset role;
insert into ok (caso, passou) values
('carteirinha continua depois do número do painel web', coalesce(
   (select numero_carteirinha = '000051' from associados where usuario_id = :'U1'), false)),
('carteirinha seguinte é a próxima', coalesce(
   (select numero_carteirinha = '000052' from associados where usuario_id = :'U2'), false));

-- M16: um pendente por (usuário, associação)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'U3' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('primeiro pedido de filiação entra',
   t($$insert into solicitacoes_filiacao (usuario_id, associacao_id, status) values ('$$ || :'U3' || $$', '$$ || :'X' || $$', 'pendente')$$) = '1');
insert into ok (caso, passou) values
('toque duplo não cria segundo pedido pendente',
   t($$insert into solicitacoes_filiacao (usuario_id, associacao_id, status) values ('$$ || :'U3' || $$', '$$ || :'X' || $$', 'pendente')$$) like 'erro%');
reset role;

-- M16: limite de validação por parceiro (2 logins do mesmo parceiro somam)
insert into parceiros (id, plano, status) values (:'PZ', 'gratuito', 'ativo');
insert into papeis_usuario (usuario_id, papel, parceiro_id) values
  (:'P3', 'parceiro', :'PZ'), (:'P4', 'parceiro', :'PZ');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'P3' || '","role":"authenticated"}', false);
select validar_resgate('ZZ-0000', :'PZ') from generate_series(1, 6);
select set_config('request.jwt.claims', '{"sub":"' || :'P4' || '","role":"authenticated"}', false);
select validar_resgate('ZZ-0000', :'PZ') from generate_series(1, 4);
select validar_resgate('ZZ-0000', :'PZ') ->> 'motivo' as motivo \gset
reset role;
insert into ok (caso, passou) values
('2º login bloqueado pelo total do parceiro (só 4 erros próprios)', :'motivo' = 'bloqueado');

select format('%-5s %s', case when passou then 'OK' else 'FALHA' end, caso) from ok order by n;
