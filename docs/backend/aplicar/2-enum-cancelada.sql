do $$
declare t regtype;
begin
  select atttypid::regtype into t from pg_attribute
   where attrelid = 'public.solicitacoes_filiacao'::regclass and attname = 'status';
  if exists (select 1 from pg_type where oid = t and typtype = 'e') then
    execute format('alter type %s add value if not exists %L', t, 'cancelada');
  end if;
end $$;
