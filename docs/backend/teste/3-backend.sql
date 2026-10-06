-- Rodar como postgres (= Edge Function/service_role) depois dos ataques.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-0000000000a1'

select corre_anonimizar_usuario(:'A');

select format('%-5s %s',
  case when ok then 'OK' else 'FALHA' end, caso) from (values
  ('exclusão: dados pessoais apagados',
   (select nome = 'Conta excluída' and email is null and cpf is null and telefone is null
      from usuarios where id = :'A')),
  ('exclusão: resgates mantidos (auditoria)',
   (select count(*) > 0 from resgates where usuario_id = :'A')),
  ('exclusão: nenhum código aberto sobra',
   (select count(*) = 0 from resgates where usuario_id = :'A' and status = 'gerado')),
  ('exclusão: baixa na associação',
   (select bool_and(status = 'desligado') from associados where usuario_id = :'A')),
  ('exclusão: papéis removidos',
   (select count(*) = 0 from papeis_usuario where usuario_id = :'A')),
  ('migration fechou código vencido (r4)',
   (select status = 'expirado' from resgates where id = 4)),
  ('código não é mais único para sempre',
   (select count(*) = 0 from pg_constraint
     where conrelid = 'resgates'::regclass and contype = 'u'))
) v(caso, ok);
