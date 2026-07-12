-- Expire cached streaks at read time so users cannot retain leaderboard/feed
-- streaks simply by not reopening the app.

create or replace function public.list_public_streaks(p_ids uuid[])
returns table (user_id uuid, current_streak integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.user_id,
    case
      when s.last_workout_date is null or current_date - s.last_workout_date >= 4 then 0
      else s.current_streak + greatest(current_date - coalesce(s.updated_at::date, current_date), 0)
    end::integer as current_streak
  from public.user_streaks s
  where s.user_id = any(p_ids);
$$;

revoke all on function public.list_public_streaks(uuid[]) from public;
grant execute on function public.list_public_streaks(uuid[]) to authenticated;

create or replace function public.get_community_leaderboard(
  p_type text,
  p_scope text,
  p_friend_ids uuid[] default '{}'::uuid[],
  p_blocked_ids uuid[] default '{}'::uuid[]
)
returns table (user_id uuid, type text, value numeric, username text, rank bigint)
language sql security definer set search_path = public stable
as $$
  with lift_e1rms as (
    select r.user_id,
      coalesce((select w.weight from public.weight_entries w where w.user_id = r.user_id
        order by w.date desc, w.created_at desc limit 1), p.starting_weight, 70)::numeric as bodyweight,
      max(case when lower(trim(lift.key)) in ('bench press', 'barbell bench press')
        then nullif(lift.value ->> 'e1rm', '')::numeric end) as bench_e1rm,
      max(case when lower(trim(lift.key)) in ('barbell back squat', 'back squat')
        then nullif(lift.value ->> 'e1rm', '')::numeric end) as squat_e1rm,
      max(case when lower(trim(lift.key)) in ('conventional deadlift', 'barbell deadlift', 'deadlift')
        then nullif(lift.value ->> 'e1rm', '')::numeric end) as deadlift_e1rm
    from public.user_ranks r
    join public.profiles p on p.id = r.user_id
    cross join lateral jsonb_each(coalesce(r.best_sets, '{}'::jsonb)) as lift(key, value)
    group by r.user_id, p.starting_weight
  ),
  leaderboard_values as (
    select l.user_id, 'strength'::text as type,
      ((coalesce(l.bench_e1rm, 0) + coalesce(l.squat_e1rm, 0) + coalesce(l.deadlift_e1rm, 0))
        / l.bodyweight)::numeric as value
    from lift_e1rms l
    where p_type = 'strength' and l.bodyweight > 0
      and (l.bench_e1rm is not null or l.squat_e1rm is not null or l.deadlift_e1rm is not null)
    union all
    select l.user_id, 'bench'::text, (l.bench_e1rm / l.bodyweight)::numeric from lift_e1rms l
    where p_type = 'bench' and l.bodyweight > 0 and l.bench_e1rm is not null
    union all
    select l.user_id, 'squat'::text, (l.squat_e1rm / l.bodyweight)::numeric from lift_e1rms l
    where p_type = 'squat' and l.bodyweight > 0 and l.squat_e1rm is not null
    union all
    select l.user_id, 'deadlift'::text, (l.deadlift_e1rm / l.bodyweight)::numeric from lift_e1rms l
    where p_type = 'deadlift' and l.bodyweight > 0 and l.deadlift_e1rm is not null
    union all
    select
      s.user_id,
      'streak'::text,
      case
        when s.last_workout_date is null or current_date - s.last_workout_date >= 4 then 0
        else s.current_streak + greatest(current_date - coalesce(s.updated_at::date, current_date), 0)
      end::numeric
    from public.user_streaks s
    where p_type = 'streak'
  ),
  visible_values as (
    select v.user_id, v.type, v.value, p.username from leaderboard_values v
    join public.profiles p on p.id = v.user_id
    where p.leaderboard_opt_in = true and (v.type <> 'streak' or p.show_streak = true)
      and not (v.user_id = any(coalesce(p_blocked_ids, '{}'::uuid[])))
      and (p_scope = 'global' or (p_scope = 'friends'
        and v.user_id = any(coalesce(p_friend_ids, '{}'::uuid[]))))
  )
  select v.user_id, v.type, v.value, v.username,
    row_number() over (order by v.value desc, v.username asc nulls last) as rank
  from visible_values v order by v.value desc, v.username asc nulls last limit 50;
$$;

revoke all on function public.get_community_leaderboard(text, text, uuid[], uuid[]) from public;
grant execute on function public.get_community_leaderboard(text, text, uuid[], uuid[]) to authenticated;
