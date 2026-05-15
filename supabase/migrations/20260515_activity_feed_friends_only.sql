-- Add a privacy flag so users can post a workout that's visible only to friends.
-- The friends-only filter is enforced both client-side (global feed RPC results)
-- and is intended to be wired into the `get_global_feed` RPC's WHERE clause.

alter table public.activity_feed
  add column if not exists friends_only boolean not null default false;

comment on column public.activity_feed.friends_only is
  'When true, this post is hidden from the global feed and shown only to the author and their friends.';
