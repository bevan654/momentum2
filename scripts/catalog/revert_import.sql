-- Revert the catalog import (batch '20261116_catalog', see import_repdb.py). Run manually, as the
-- service role / postgres, only if needed:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/catalog/revert_import.sql
--
-- Puts back every logged old value and deletes every row the import added, newest change first.
-- The exercises_link_identity trigger is switched off for the duration (inside this transaction only):
-- the logged catalog_id values are restored as they were, instead of being re-resolved from the name.
-- Leaves the 20261116_catalog_overhaul.sql schema in place, and the batch's data_change_log rows as a record.
-- Rows written by the app after the import are not touched, except that an exercise linked to an added
-- catalog row loses that link (exercises.catalog_id is ON DELETE SET NULL).

begin;
set local lock_timeout = '10s';

alter table public.exercises disable trigger exercises_link_identity;

delete from public.exercise_muscle_targets;

do $$
declare r record;
begin
  for r in select * from public.data_change_log where batch = '20261116_catalog' order by id desc loop
    if r.column_name = '_row' then
      execute format('delete from public.%I where id = %L', r.table_name, r.row_id);
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
