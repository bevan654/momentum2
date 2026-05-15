-- ============================================================================
-- list_public_streaks — fetch current_streak for arbitrary user ids,
-- bypassing the owner-only RLS on `user_streaks`.
--
-- Used by the global feed so strangers' streak counts can be rendered
-- alongside their feed posts. Returns only (user_id, current_streak) —
-- longest_streak and other fields are intentionally not exposed.
-- ============================================================================

create or replace function public.list_public_streaks(p_ids uuid[])
returns table (user_id uuid, current_streak integer)
language sql
security definer
set search_path = public
as $$
  select s.user_id, s.current_streak
  from public.user_streaks s
  where s.user_id = any(p_ids);
$$;

revoke all on function public.list_public_streaks(uuid[]) from public;
grant execute on function public.list_public_streaks(uuid[]) to authenticated;

comment on function public.list_public_streaks(uuid[]) is
  'Returns current_streak for the given user ids regardless of viewer-owner relationship. SECURITY DEFINER intentionally bypasses user_streaks RLS; only current_streak is exposed.';
