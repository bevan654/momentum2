-- ============================================================================
-- reactions.emoji — ensure the column the client writes/reads actually exists.
--
-- database-schema.md shows a legacy `type USER-DEFINED NOT NULL` column on
-- public.reactions, but the app code uses `emoji TEXT` ('❤️' for likes).
-- Without this migration the INSERT in addReaction() silently fails on the
-- NOT NULL `type` constraint, so likes never persist.
--
-- This migration:
--   1. Adds `emoji TEXT` if missing (idempotent).
--   2. Drops NOT NULL on `type` if it exists, since the client no longer
--      supplies it.
-- ============================================================================

alter table public.reactions
  add column if not exists emoji text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reactions'
      and column_name = 'type'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.reactions alter column type drop not null';
  end if;
end $$;

create index if not exists reactions_activity_idx
  on public.reactions (activity_id);
