select 'tabelas da jornada (esperado 4)' k, count(*)::text v from pg_tables
 where schemaname = 'public' and tablename in ('apps_entrega','jornadas','jornada_ganhos','abastecimentos')
union all
select 'apps no catálogo (esperado 9)', count(*)::text from public.apps_entrega
union all
select 'bucket jornada-fotos (esperado 1)', count(*)::text from storage.buckets where id = 'jornada-fotos'
union all
select 'RLS ligado (esperado 3)', count(*)::text from pg_class
 where relnamespace = 'public'::regnamespace and relrowsecurity
   and relname in ('jornadas','jornada_ganhos','abastecimentos')
union all
select 'índices da parte 9 (esperado 6)', count(*)::text from pg_indexes
 where indexname in ('corre_resgates_usuario_gerado_idx','corre_resgates_oferta_status_idx',
   'corre_resgates_validados_idx','corre_tentativas_parceiro_idx','corre_tokens_expira_idx',
   'corre_filiacao_uma_pendente')
union all
select 'contador de carteirinha (nº de associações)', count(*)::text from public.carteirinha_sequencias;
