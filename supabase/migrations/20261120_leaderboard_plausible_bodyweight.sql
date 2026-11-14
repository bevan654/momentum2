-- Leaderboard: ignore implausible bodyweights.
--
-- get_community_leaderboard divided each lift by the latest weigh-in unchecked,
-- so a typo (production has a 199,999,999 kg entry) put that user's ratios at
-- ~0, and a 12 kg starting weight inflated another's. Only weigh-ins and
-- starting weights within 30-300 kg (the range onboarding and the app accept)
-- count now; otherwise the fallback is 70 kg as before.
--
-- Same function, same signature and grants (create or replace keeps them);
-- only the bodyweight expression changes. No data is modified.

begin;

CREATE OR REPLACE FUNCTION public.get_community_leaderboard(p_type text, p_scope text, p_friend_ids uuid[] DEFAULT '{}'::uuid[], p_blocked_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(user_id uuid, type text, value numeric, username text, rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with lift_weights as (
    select r.user_id,
      -- Latest plausible weigh-in, else a plausible starting weight, else 70 kg. 30-300 kg is the
      -- range onboarding and the app accept (BODYWEIGHT_RANGE_KG); typos outside it are ignored.
      coalesce((select w.weight from public.weight_entries w where w.user_id = r.user_id
          and w.weight between 30 and 300
        order by w.date desc, w.created_at desc limit 1),
        case when p.starting_weight between 30 and 300 then p.starting_weight end, 70)::numeric as bodyweight,
      max(case when lower(trim(lift.key)) in ('bench press', 'barbell bench press') then nullif(lift.value ->> 'kg', '')::numeric end) as bench_kg,
      max(case when lower(trim(lift.key)) in ('barbell back squat', 'back squat') then nullif(lift.value ->> 'kg', '')::numeric end) as squat_kg,
      max(case when lower(trim(lift.key)) in ('conventional deadlift', 'barbell deadlift', 'deadlift') then nullif(lift.value ->> 'kg', '')::numeric end) as deadlift_kg
    from public.user_ranks r join public.profiles p on p.id = r.user_id
    cross join lateral jsonb_each(coalesce(r.best_sets, '{}'::jsonb)) as lift(key, value)
    group by r.user_id, p.starting_weight
  ), leaderboard_values as (
    select l.user_id, 'strength'::text as type,
      ((coalesce(l.bench_kg, 0) + coalesce(l.squat_kg, 0) + coalesce(l.deadlift_kg, 0)) / (l.bodyweight * 3))::numeric as value
    from lift_weights l where p_type = 'strength' and l.bodyweight > 0
      and (l.bench_kg is not null or l.squat_kg is not null or l.deadlift_kg is not null)
    union all select l.user_id, 'bench', (l.bench_kg / l.bodyweight)::numeric from lift_weights l where p_type = 'bench' and l.bodyweight > 0 and l.bench_kg is not null
    union all select l.user_id, 'squat', (l.squat_kg / l.bodyweight)::numeric from lift_weights l where p_type = 'squat' and l.bodyweight > 0 and l.squat_kg is not null
    union all select l.user_id, 'deadlift', (l.deadlift_kg / l.bodyweight)::numeric from lift_weights l where p_type = 'deadlift' and l.bodyweight > 0 and l.deadlift_kg is not null
    union all select s.user_id, 'streak',
      case when s.last_workout_date is null or current_date - s.last_workout_date >= 4 then 0
        else s.current_streak + greatest(current_date - greatest(s.last_workout_date, coalesce(s.updated_at::date, s.last_workout_date)), 0)
      end::numeric
    from public.user_streaks s where p_type = 'streak'
    union all select s.user_id, 'streak_best',
      greatest(
        s.longest_streak,
        case when s.last_workout_date is null or current_date - s.last_workout_date >= 4 then 0
          else s.current_streak + greatest(current_date - greatest(s.last_workout_date, coalesce(s.updated_at::date, s.last_workout_date)), 0)
        end
      )::numeric
    from public.user_streaks s where p_type = 'streak_best'
  ), visible_values as (
    select v.user_id, v.type, v.value, p.username from leaderboard_values v join public.profiles p on p.id = v.user_id
    where p.leaderboard_opt_in = true and (v.type not in ('streak', 'streak_best') or p.show_streak = true)
      and not (v.user_id = any(coalesce(p_blocked_ids, '{}'::uuid[])))
      and (p_scope = 'global' or (p_scope = 'friends' and v.user_id = any(coalesce(p_friend_ids, '{}'::uuid[]))))
  ) select v.user_id, v.type, v.value, v.username,
      row_number() over (order by v.value desc, v.username asc nulls last)
    from visible_values v order by v.value desc, v.username asc nulls last limit 50;
$function$;

commit;
