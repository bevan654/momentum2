-- Revert the catalog dedupe (batch '20261117_catalog_dedupe', see
-- supabase/migrations/20261117_catalog_dedupe.sql). Run manually, as the service role / postgres,
-- only if needed:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/catalog/revert_dedupe.sql
--
-- Puts back every logged old value (newest change first) and deletes the aliases the batch added.
-- The exercises_link_identity trigger is switched off for the duration (inside this transaction only),
-- so the logged catalog_id / user_exercise_id values are restored as they were instead of re-resolved.
-- The batch's data_change_log rows stay as a record.

begin;
set local lock_timeout = '10s';

alter table public.exercises disable trigger exercises_link_identity;

do $$
declare r record;
begin
  for r in select * from public.data_change_log where batch = '20261117_catalog_dedupe' order by id desc loop
    if r.column_name = '_row' then
      execute format('delete from public.%I where id = %L', r.table_name, r.row_id);
    elsif r.table_name = 'exercises_catalog' then
      -- exercises_catalog.id is text
      execute format('update public.%I set %I = (%L::jsonb #>> ''{}'')::%s where id = %L',
        r.table_name, r.column_name, r.old_value,
        (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
          where a.attrelid = ('public.' || r.table_name)::regclass and a.attname = r.column_name),
        r.row_id::text);
    else
      execute format('update public.%I set %I = (%L::jsonb #>> ''{}'')::%s where id = %L',
        r.table_name, r.column_name, r.old_value,
        (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
          where a.attrelid = ('public.' || r.table_name)::regclass and a.attname = r.column_name),
        r.row_id);
    end if;
  end loop;
end $$;

alter table public.exercises enable trigger exercises_link_identity;

commit;
