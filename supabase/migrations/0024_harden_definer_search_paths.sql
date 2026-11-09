-- Put PostgreSQL's built-ins first and the explicitly trusted application
-- schema before the temporary schema for every SECURITY DEFINER routine in
-- public. This is forward-only and changes function settings, not data or
-- function bodies. Re-running it is safe.
do $$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, pg_temp',
      routine.signature
    );
  end loop;
end
$$;
