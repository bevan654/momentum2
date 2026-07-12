-- Add an all-time longest-streak board alongside the live current-streak board.

alter table public.leaderboard_rank_snapshots
  drop constraint if exists leaderboard_rank_snapshots_board_type_check;
alter table public.leaderboard_rank_snapshots
  add constraint leaderboard_rank_snapshots_board_type_check
  check (board_type in ('strength', 'bench', 'squat', 'deadlift', 'streak', 'streak_best'));

create or replace function public.get_community_leaderboard(
  p_type text, p_scope text, p_friend_ids uuid[] default '{}'::uuid[],
  p_blocked_ids uuid[] default '{}'::uuid[]
)
returns table (user_id uuid, type text, value numeric, username text, rank bigint)
language sql security definer set search_path = public stable
as $$
  with lift_weights as (
    select r.user_id,
      coalesce((select w.weight from public.weight_entries w where w.user_id = r.user_id
        order by w.date desc, w.created_at desc limit 1), p.starting_weight, 70)::numeric as bodyweight,
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
    union all select s.user_id, 'streak_best', s.longest_streak::numeric
    from public.user_streaks s where p_type = 'streak_best'
  ), visible_values as (
    select v.user_id, v.type, v.value, p.username from leaderboard_values v join public.profiles p on p.id = v.user_id
    where p.leaderboard_opt_in = true and (v.type not in ('streak', 'streak_best') or p.show_streak = true)
      and not (v.user_id = any(coalesce(p_blocked_ids, '{}'::uuid[])))
      and (p_scope = 'global' or (p_scope = 'friends' and v.user_id = any(coalesce(p_friend_ids, '{}'::uuid[]))))
  ) select v.user_id, v.type, v.value, v.username,
      row_number() over (order by v.value desc, v.username asc nulls last)
    from visible_values v order by v.value desc, v.username asc nulls last limit 50;
$$;

create or replace function public.refresh_leaderboard_rankings(p_type text, p_send_notifications boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
declare crossing record; board_label text;
begin
  if p_type not in ('strength', 'bench', 'squat', 'deadlift', 'streak', 'streak_best') then
    raise exception 'Unsupported leaderboard type: %', p_type;
  end if;
  perform pg_advisory_xact_lock(hashtext('leaderboard:' || p_type));
  board_label := case p_type
    when 'strength' then 'Total Strength' when 'bench' then 'Bench Press'
    when 'squat' then 'Back Squat' when 'deadlift' then 'Deadlift'
    when 'streak' then 'Current Streak' when 'streak_best' then 'All-Time Streak' end;

  if p_send_notifications then
    for crossing in
      with current_ranks as (
        select user_id, username, rank::integer, value
        from public.get_community_leaderboard(p_type, 'global', '{}'::uuid[], '{}'::uuid[])
      )
      select overtaker.user_id overtaker_id, coalesce(overtaker.username, 'An athlete') overtaker_name,
        old_overtaker.rank overtaker_old_rank, overtaker.rank overtaker_new_rank,
        passed.user_id passed_id, coalesce(passed.username, 'An athlete') passed_name,
        old_passed.rank passed_old_rank, passed.rank passed_new_rank
      from current_ranks overtaker
      join public.leaderboard_rank_snapshots old_overtaker
        on old_overtaker.user_id = overtaker.user_id and old_overtaker.board_type = p_type
      join current_ranks passed on passed.user_id <> overtaker.user_id
      join public.leaderboard_rank_snapshots old_passed
        on old_passed.user_id = passed.user_id and old_passed.board_type = p_type
      where old_overtaker.rank > old_passed.rank and overtaker.rank < passed.rank
    loop
      execute 'insert into public.notifications (user_id, type, title, body, data, read)
        values ($1, ''leaderboard_overtake'', $2, $3, $4, false)'
      using crossing.overtaker_id, 'You moved up to #' || crossing.overtaker_new_rank,
        'You overtook ' || crossing.passed_name || ' on the ' || board_label || ' leaderboard.',
        jsonb_build_object('board_type', p_type, 'direction', 'up', 'other_user_id', crossing.passed_id,
          'old_rank', crossing.overtaker_old_rank, 'new_rank', crossing.overtaker_new_rank);
      execute 'insert into public.notifications (user_id, type, title, body, data, read)
        values ($1, ''leaderboard_overtake'', $2, $3, $4, false)'
      using crossing.passed_id, crossing.overtaker_name || ' overtook you',
        'You are now #' || crossing.passed_new_rank || ' on the ' || board_label || ' leaderboard.',
        jsonb_build_object('board_type', p_type, 'direction', 'down', 'other_user_id', crossing.overtaker_id,
          'old_rank', crossing.passed_old_rank, 'new_rank', crossing.passed_new_rank);
    end loop;
  end if;

  delete from public.leaderboard_rank_snapshots snapshot
  where snapshot.board_type = p_type and not exists (
    select 1 from public.get_community_leaderboard(p_type, 'global', '{}'::uuid[], '{}'::uuid[]) current_rank
    where current_rank.user_id = snapshot.user_id
  );
  insert into public.leaderboard_rank_snapshots (user_id, board_type, rank, value, updated_at)
  select user_id, p_type, rank::integer, value, now()
  from public.get_community_leaderboard(p_type, 'global', '{}'::uuid[], '{}'::uuid[])
  on conflict (user_id, board_type) do update set rank = excluded.rank, value = excluded.value, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.refresh_leaderboard_rankings(text, boolean) from public;
grant execute on function public.refresh_leaderboard_rankings(text, boolean) to service_role;

create or replace function public.refresh_streak_leaderboard_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_leaderboard_rankings('streak', true);
  perform public.refresh_leaderboard_rankings('streak_best', true);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

select public.refresh_leaderboard_rankings('streak_best', false);
