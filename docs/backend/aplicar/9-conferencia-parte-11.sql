select 'tabelas da rota 3B (esperado 4)' k, count(*)::text v from pg_tables
 where schemaname = 'public' and tablename in ('app_flags', 'textos_consentimento', 'consentimentos', 'leads_parceiros')
union all
select 'flag rota_3b (esperado false)',
       coalesce((select ligada::text from public.app_flags where chave = 'rota_3b'), 'ausente')
union all
select 'RLS ligado (esperado 3)', count(*)::text from pg_class
 where relnamespace = 'public'::regnamespace and relrowsecurity
   and relname in ('app_flags', 'consentimentos', 'leads_parceiros')
union all
select 'triggers de proteção (esperado 2)', count(*)::text from pg_trigger
 where tgname in ('corre_consentimentos_proteger', 'corre_leads_proteger')
union all
select 'texto de consentimento vigente (esperado 3b-2026-11-17-provisorio)',
       coalesce((select versao from public.textos_consentimento
                  where finalidade = '3b_indenizacao'
                  order by criado_em desc limit 1), 'ausente');
