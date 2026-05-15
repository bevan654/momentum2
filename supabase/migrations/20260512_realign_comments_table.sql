-- ============================================================================
-- Realign comments to the schema the client code already uses
-- ----------------------------------------------------------------------------
-- The previous migration (20260512_feed_photos_and_comments.sql) created
-- `activity_comments(content, parent_comment_id)`, but the client in
-- src/lib/friendsDatabase.ts already targets `comments(text, parent_id)` via
-- direct table queries (no RPC). Easiest fix: drop the unused table + RPCs and
-- create `comments` to match the client.
-- ============================================================================


-- ── 1. Drop the unused table and its accessory objects ─────────────────────

-- RPCs only existed on activity_comments; drop them explicitly so they don't
-- linger pointing at the dropped table.
drop function if exists public.get_activity_comments(uuid, int, int);
drop function if exists public.get_comment_counts(uuid[]);

-- Trigger function used only by activity_comments.
drop function if exists public.touch_activity_comment_edited_at() cascade;

-- Drop the table (cascades indexes + RLS policies).
drop table if exists public.activity_comments cascade;


-- ── 2. Create `comments` matching the client ───────────────────────────────

create table if not exists public.comments (
  id          uuid        primary key default gen_random_uuid(),
  activity_id uuid        not null references public.activity_feed(id) on delete cascade,
  user_id     uuid        not null references auth.users(id)           on delete cascade,
  parent_id   uuid                 references public.comments(id)      on delete cascade,
  text        text        not null check (char_length(text) between 1 and 1000),
  created_at  timestamptz not null default now()
);

comment on table public.comments is
  'Comments on activity_feed posts. Supports one level of replies via parent_id. Schema matches src/lib/friendsDatabase.ts.';

create index if not exists comments_activity_idx
  on public.comments (activity_id, created_at asc);

create index if not exists comments_user_idx
  on public.comments (user_id);

create index if not exists comments_parent_idx
  on public.comments (parent_id)
  where parent_id is not null;


-- ── 3. RLS ─────────────────────────────────────────────────────────────────

alter table public.comments enable row level security;

-- Read: anyone who can see the parent activity. activity_feed's own RLS
-- already gates visibility (owner or friend of owner), so the EXISTS subquery
-- inherits that gate.
drop policy if exists "comments: read via activity" on public.comments;
create policy "comments: read via activity"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.activity_feed af
      where af.id = comments.activity_id
    )
  );

-- Insert: must be the authenticated user, parent activity must be visible.
drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own"
  on public.comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.activity_feed af
      where af.id = comments.activity_id
    )
  );

-- Update: owner only; user_id and activity_id are pinned via WITH CHECK.
drop policy if exists "comments: update own" on public.comments;
create policy "comments: update own"
  on public.comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: comment owner OR activity owner (lets post authors moderate replies).
drop policy if exists "comments: delete own or activity owner" on public.comments;
create policy "comments: delete own or activity owner"
  on public.comments
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.activity_feed af
      where af.id = comments.activity_id and af.user_id = auth.uid()
    )
  );
