-- Community leaderboard backed by the existing rank and streak stores.
-- Only the minimum public fields are exposed, and profile privacy settings are
-- enforced inside this SECURITY DEFINER function.

create or replace function public.get_community_leaderboard(
  p_type text,
  p_scope text,
  p_friend_ids uuid[] default '{}'::uuid[],
  p_blocked_ids uuid[] default '{}'::uuid[]
)
returns table (
  user_id uuid,
  type text,
  value numeric,
  username text,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with leaderboard_values as (
    select
      r.user_id,
      'strength'::text as type,
      r.overall_score::numeric as value
    from public.user_ranks r
    where p_type = 'strength'

    union all

    select
      s.user_id,
      'streak'::text as type,
      s.current_streak::numeric as value
    from public.user_streaks s
    where p_type = 'streak'
  ),
  visible_values as (
    select
      v.user_id,
      v.type,
      v.value,
      p.username
    from leaderboard_values v
    join public.profiles p on p.id = v.user_id
    where p.leaderboard_opt_in = true
      and (v.type <> 'streak' or p.show_streak = true)
      and not (v.user_id = any(coalesce(p_blocked_ids, '{}'::uuid[])))
      and (
        p_scope = 'global'
        or (
          p_scope = 'friends'
          and v.user_id = any(coalesce(p_friend_ids, '{}'::uuid[]))
        )
      )
  )
  select
    v.user_id,
    v.type,
    v.value,
    v.username,
    row_number() over (order by v.value desc, v.username asc nulls last) as rank
  from visible_values v
  order by v.value desc, v.username asc nulls last
  limit 50;
$$;

revoke all on function public.get_community_leaderboard(text, text, uuid[], uuid[]) from public;
grant execute on function public.get_community_leaderboard(text, text, uuid[], uuid[]) to authenticated;

comment on function public.get_community_leaderboard(text, text, uuid[], uuid[]) is
  'Returns privacy-filtered strength-rating or workout-streak leaderboard rows for Community.';
