select 'tabelas de emergência (esperado 2)' k, count(*)::text v from pg_tables
 where schemaname = 'public' and tablename in ('contatos_emergencia', 'emergencia_eventos')
union all
select 'RLS ligado (esperado 2)', count(*)::text from pg_class
 where relnamespace = 'public'::regnamespace and relrowsecurity
   and relname in ('contatos_emergencia', 'emergencia_eventos')
union all
select 'triggers de proteção (esperado 2)', count(*)::text from pg_trigger
 where tgname in ('corre_contato_emergencia_proteger', 'corre_emergencia_eventos_proteger')
union all
select 'exclusão de conta apaga emergência (esperado true)',
       (pg_get_functiondef('public.corre_anonimizar_dados(uuid)'::regprocedure)
          like '%emergencia_eventos%')::text;
