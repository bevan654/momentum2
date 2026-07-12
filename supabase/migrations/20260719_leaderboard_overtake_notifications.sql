-- Pairwise leaderboard overtake notifications.

do $$
declare
  enum_type text;
begin
  select udt_name into enum_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'notifications'
    and column_name = 'type';

  if enum_type is null then
    raise exception 'Could not resolve notifications.type enum name';
  end if;

  execute format(
    'alter type %I add value if not exists %L',
    enum_type,
    'leaderboard_overtake'
  );
end $$;

create table if not exists public.leaderboard_rank_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  board_type text not null check (board_type in ('strength', 'bench', 'squat', 'deadlift', 'streak')),
  rank integer not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, board_type)
);

alter table public.leaderboard_rank_snapshots enable row level security;

create or replace function public.refresh_leaderboard_rankings(
  p_type text,
  p_send_notifications boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  crossing record;
  board_label text;
begin
  if p_type not in ('strength', 'bench', 'squat', 'deadlift', 'streak') then
    raise exception 'Unsupported leaderboard type: %', p_type;
  end if;

  -- Prevent simultaneous rank writers from comparing against the same stale snapshot.
  perform pg_advisory_xact_lock(hashtext('leaderboard:' || p_type));

  board_label := case p_type
    when 'strength' then 'Total Strength'
    when 'bench' then 'Bench Press'
    when 'squat' then 'Back Squat'
    when 'deadlift' then 'Deadlift'
    when 'streak' then 'Workout Streak'
  end;

  if p_send_notifications then
    for crossing in
      with current_ranks as (
        select user_id, username, rank::integer, value
        from public.get_community_leaderboard(
          p_type,
          'global',
          '{}'::uuid[],
          '{}'::uuid[]
        )
      )
      select
        overtaker.user_id as overtaker_id,
        coalesce(overtaker.username, 'An athlete') as overtaker_name,
        old_overtaker.rank as overtaker_old_rank,
        overtaker.rank as overtaker_new_rank,
        passed.user_id as passed_id,
        coalesce(passed.username, 'An athlete') as passed_name,
        old_passed.rank as passed_old_rank,
        passed.rank as passed_new_rank
      from current_ranks overtaker
      join public.leaderboard_rank_snapshots old_overtaker
        on old_overtaker.user_id = overtaker.user_id
       and old_overtaker.board_type = p_type
      join current_ranks passed on passed.user_id <> overtaker.user_id
      join public.leaderboard_rank_snapshots old_passed
        on old_passed.user_id = passed.user_id
       and old_passed.board_type = p_type
      where old_overtaker.rank > old_passed.rank
        and overtaker.rank < passed.rank
    loop
      -- Dynamic SQL defers use of the newly-added enum value until after this
      -- migration commits.
      execute '
        insert into public.notifications (user_id, type, title, body, data, read)
        values ($1, ''leaderboard_overtake'', $2, $3, $4, false)'
      using
        crossing.overtaker_id,
        'You moved up to #' || crossing.overtaker_new_rank,
        'You overtook ' || crossing.passed_name || ' on the ' || board_label || ' leaderboard.',
        jsonb_build_object(
          'board_type', p_type,
          'direction', 'up',
          'other_user_id', crossing.passed_id,
          'old_rank', crossing.overtaker_old_rank,
          'new_rank', crossing.overtaker_new_rank
        );

      execute '
        insert into public.notifications (user_id, type, title, body, data, read)
        values ($1, ''leaderboard_overtake'', $2, $3, $4, false)'
      using
        crossing.passed_id,
        crossing.overtaker_name || ' overtook you',
        'You are now #' || crossing.passed_new_rank || ' on the ' || board_label || ' leaderboard.',
        jsonb_build_object(
          'board_type', p_type,
          'direction', 'down',
          'other_user_id', crossing.overtaker_id,
          'old_rank', crossing.passed_old_rank,
          'new_rank', crossing.passed_new_rank
        );
    end loop;
  end if;

  delete from public.leaderboard_rank_snapshots snapshot
  where snapshot.board_type = p_type
    and not exists (
      select 1
      from public.get_community_leaderboard(
        p_type,
        'global',
        '{}'::uuid[],
        '{}'::uuid[]
      ) current_rank
      where current_rank.user_id = snapshot.user_id
    );

  insert into public.leaderboard_rank_snapshots (
    user_id,
    board_type,
    rank,
    value,
    updated_at
  )
  select user_id, p_type, rank::integer, value, now()
  from public.get_community_leaderboard(
    p_type,
    'global',
    '{}'::uuid[],
    '{}'::uuid[]
  )
  on conflict (user_id, board_type) do update set
    rank = excluded.rank,
    value = excluded.value,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.refresh_leaderboard_rankings(text, boolean) from public;
grant execute on function public.refresh_leaderboard_rankings(text, boolean) to service_role;

create or replace function public.refresh_strength_leaderboards_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_leaderboard_rankings('strength', true);
  perform public.refresh_leaderboard_rankings('bench', true);
  perform public.refresh_leaderboard_rankings('squat', true);
  perform public.refresh_leaderboard_rankings('deadlift', true);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_streak_leaderboard_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_leaderboard_rankings('streak', true);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_strength_leaderboards_on_rank on public.user_ranks;
create trigger refresh_strength_leaderboards_on_rank
after insert or update of best_sets on public.user_ranks
for each row execute function public.refresh_strength_leaderboards_trigger();

drop trigger if exists refresh_strength_leaderboards_on_weight on public.weight_entries;
create trigger refresh_strength_leaderboards_on_weight
after insert or update of weight or delete on public.weight_entries
for each row execute function public.refresh_strength_leaderboards_trigger();

drop trigger if exists refresh_streak_leaderboard_on_streak on public.user_streaks;
create trigger refresh_streak_leaderboard_on_streak
after insert or update of current_streak, last_workout_date on public.user_streaks
for each row execute function public.refresh_streak_leaderboard_trigger();

-- Establish baselines without creating historical notifications.
select public.refresh_leaderboard_rankings('strength', false);
select public.refresh_leaderboard_rankings('bench', false);
select public.refresh_leaderboard_rankings('squat', false);
select public.refresh_leaderboard_rankings('deadlift', false);
select public.refresh_leaderboard_rankings('streak', false);
