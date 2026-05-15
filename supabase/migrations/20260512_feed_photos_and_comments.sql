-- ============================================================================
-- Feed: workout photos + comments
-- ----------------------------------------------------------------------------
-- Likes are NOT in this migration — the existing `reactions` table already
-- supports per-emoji reactions, so the IG-style heart uses emoji '❤️' there.
-- ============================================================================


-- ── 1. Workout photos ───────────────────────────────────────────────────────

alter table public.workouts
  add column if not exists photo_path text,
  add column if not exists photo_thumb_path text;

comment on column public.workouts.photo_path is
  'Object path in the workout_photos storage bucket (e.g. "{user_id}/{workout_id}.jpg"). Resolve to URL at read time.';
comment on column public.workouts.photo_thumb_path is
  'Optional dedicated thumbnail path. When null, callers should request a resized variant of photo_path via Supabase Image Transformations.';


-- ── 2. Storage bucket for photos ────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('workout_photos', 'workout_photos', true)
on conflict (id) do nothing;

-- Users may upload only into a folder matching their own user id.
drop policy if exists "workout_photos: owners upload" on storage.objects;
create policy "workout_photos: owners upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'workout_photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can replace / delete their own photos (e.g. user re-uploads).
drop policy if exists "workout_photos: owners update" on storage.objects;
create policy "workout_photos: owners update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'workout_photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "workout_photos: owners delete" on storage.objects;
create policy "workout_photos: owners delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'workout_photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read: bucket is marked public so the CDN can serve photos referenced
-- from feed cards without signed URLs. Visibility of *which* workouts a viewer
-- sees is enforced by the activity_feed / friendships RLS, not by storage.
drop policy if exists "workout_photos: public read" on storage.objects;
create policy "workout_photos: public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'workout_photos');


-- ── 3. Comments table ───────────────────────────────────────────────────────

create table if not exists public.activity_comments (
  id                uuid        primary key default gen_random_uuid(),
  activity_id       uuid        not null references public.activity_feed(id) on delete cascade,
  user_id           uuid        not null references auth.users(id)            on delete cascade,
  parent_comment_id uuid                 references public.activity_comments(id) on delete cascade,
  content           text        not null check (char_length(content) between 1 and 1000),
  created_at        timestamptz not null default now(),
  edited_at         timestamptz
);

comment on table  public.activity_comments      is 'Comments on activity_feed posts. Supports one level of replies via parent_comment_id.';
comment on column public.activity_comments.edited_at is 'Set whenever content is updated post-creation. Null for never-edited comments.';

create index if not exists activity_comments_activity_idx
  on public.activity_comments (activity_id, created_at desc);

create index if not exists activity_comments_user_idx
  on public.activity_comments (user_id);

create index if not exists activity_comments_parent_idx
  on public.activity_comments (parent_comment_id)
  where parent_comment_id is not null;


-- ── 4. RLS for activity_comments ────────────────────────────────────────────

alter table public.activity_comments enable row level security;

-- Read: anyone who can see the parent activity. The activity_feed RLS already
-- restricts visibility to (a) the author or (b) a friend of the author, so
-- delegating to it here means we only ever need to maintain one visibility
-- rule across both tables.
drop policy if exists "activity_comments: read via activity" on public.activity_comments;
create policy "activity_comments: read via activity"
  on public.activity_comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.activity_feed af
      where af.id = activity_comments.activity_id
    )
  );

-- Insert: must be the authenticated user, and the parent activity must be
-- visible (same gate as read).
drop policy if exists "activity_comments: insert own" on public.activity_comments;
create policy "activity_comments: insert own"
  on public.activity_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.activity_feed af
      where af.id = activity_comments.activity_id
    )
  );

-- Update: owner only. Also keeps user_id immutable.
drop policy if exists "activity_comments: update own" on public.activity_comments;
create policy "activity_comments: update own"
  on public.activity_comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: owner of the comment OR owner of the activity (lets post authors
-- moderate their own threads).
drop policy if exists "activity_comments: delete own or activity owner" on public.activity_comments;
create policy "activity_comments: delete own or activity owner"
  on public.activity_comments
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.activity_feed af
      where af.id = activity_comments.activity_id and af.user_id = auth.uid()
    )
  );


-- ── 5. RPC: comment counts (matches what useFriendsStore.fetchCommentCounts wants) ──

create or replace function public.get_comment_counts(p_activity_ids uuid[])
returns table (activity_id uuid, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.activity_id, count(*)::bigint
  from public.activity_comments c
  where c.activity_id = any (p_activity_ids)
  group by c.activity_id
$$;

grant execute on function public.get_comment_counts(uuid[]) to authenticated;


-- ── 6. RPC: paginated comment list (one round-trip with profile data) ───────
-- NOTE: joins `public_profiles` view (not `profiles`) — RLS on `profiles` is
-- owner-only, so a direct join returns null username/email for everyone except
-- the viewer themselves. See CLAUDE.md "Cross-user reads".

create or replace function public.get_activity_comments(
  p_activity_id uuid,
  p_limit       int default 50,
  p_offset      int default 0
)
returns table (
  id                uuid,
  activity_id       uuid,
  user_id           uuid,
  parent_comment_id uuid,
  content           text,
  created_at        timestamptz,
  edited_at         timestamptz,
  username          text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.activity_id, c.user_id, c.parent_comment_id,
    c.content, c.created_at, c.edited_at,
    pp.username
  from public.activity_comments c
  left join public.public_profiles pp on pp.id = c.user_id
  where c.activity_id = p_activity_id
  order by c.created_at asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0)
$$;

grant execute on function public.get_activity_comments(uuid, int, int) to authenticated;


-- ── 7. (Optional) edited_at trigger ─────────────────────────────────────────

create or replace function public.touch_activity_comment_edited_at()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content then
    new.edited_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists activity_comments_touch_edited_at on public.activity_comments;
create trigger activity_comments_touch_edited_at
  before update on public.activity_comments
  for each row execute function public.touch_activity_comment_edited_at();
