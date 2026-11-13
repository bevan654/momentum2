-- One-tap feedback used to verify whether the historical workout-finish hang
-- is still affecting users. The prompt is shown once per feedback campaign.

create table if not exists public.workout_finish_feedback (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  workout_id    uuid        references public.workouts(id) on delete set null,
  response      text        not null check (response in ('worked_normally', 'had_issue')),
  campaign      text        not null,
  build_version text        not null,
  source        text        not null default 'post_workout' check (source = 'post_workout'),
  created_at    timestamptz not null default now()
);

create index if not exists workout_finish_feedback_created_idx
  on public.workout_finish_feedback (created_at desc);

create index if not exists workout_finish_feedback_response_idx
  on public.workout_finish_feedback (campaign, build_version, response, created_at desc);

alter table public.workout_finish_feedback enable row level security;

drop policy if exists "Users can submit workout finish feedback"
  on public.workout_finish_feedback;
create policy "Users can submit workout finish feedback"
  on public.workout_finish_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users do not need read/update/delete access. Aggregate results can be viewed
-- by project administrators in the Supabase dashboard or SQL editor.
