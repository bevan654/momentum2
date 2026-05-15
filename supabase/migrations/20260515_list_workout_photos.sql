-- ============================================================================
-- list_workout_photos — fetch photo paths for arbitrary workout ids,
-- bypassing the owner-only RLS on `workouts`.
--
-- Used by the global feed so strangers' workout photos can be rendered.
-- Returns only (id, photo_path) — no other workout data is leaked.
-- ============================================================================

create or replace function public.list_workout_photos(p_workout_ids uuid[])
returns table (id uuid, photo_path text)
language sql
security definer
set search_path = public
as $$
  select w.id, w.photo_path
  from public.workouts w
  where w.id = any(p_workout_ids)
    and w.photo_path is not null;
$$;

revoke all on function public.list_workout_photos(uuid[]) from public;
grant execute on function public.list_workout_photos(uuid[]) to authenticated;

comment on function public.list_workout_photos(uuid[]) is
  'Returns photo_path for the given workout ids regardless of viewer-owner relationship. SECURITY DEFINER intentionally bypasses workouts RLS; only photo_path is exposed.';
