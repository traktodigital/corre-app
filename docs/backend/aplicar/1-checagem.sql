select 'status da filiação' k, format_type(atttypid, atttypmod) v
  from pg_attribute where attrelid = 'public.solicitacoes_filiacao'::regclass and attname = 'status'
union all
select 'valores do enum', coalesce(string_agg(e.enumlabel, ', ' order by e.enumsortorder), '(não é enum)')
  from pg_enum e
 where e.enumtypid = (select a.atttypid from pg_attribute a
                       where a.attrelid = 'public.solicitacoes_filiacao'::regclass and a.attname = 'status')
union all
select 'checks da filiação', coalesce(string_agg(pg_get_constraintdef(oid), ' | '), 'nenhum')
  from pg_constraint where conrelid = 'public.solicitacoes_filiacao'::regclass and contype = 'c'
union all
select 'partes 6 e 7 aplicadas',
       (exists (select 1 from pg_proc where proname = 'aprovar_solicitacao_filiacao')
    and exists (select 1 from pg_proc where proname = 'corre_anonimizar_dados'))::text
union all
select 'pg_cron', coalesce(max(installed_version), 'não instalado')
       || case when count(*) = 0 then ' (indisponível)' else '' end
  from pg_available_extensions where name = 'pg_cron'
union all
select 'filiações pendentes duplicadas', count(*)::text
  from (select 1 from public.solicitacoes_filiacao where status::text = 'pendente'
         group by usuario_id, associacao_id having count(*) > 1) d
union all
select 'parte 8 já aplicada?', (to_regclass('public.jornadas') is not null)::text
union all
select 'parte 9 já aplicada?', (to_regclass('public.carteirinha_sequencias') is not null)::text;
