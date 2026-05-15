-- Optional user-authored title and caption on feed posts.
-- Both nullable; existing rows remain untouched.

alter table public.activity_feed
  add column if not exists title text,
  add column if not exists caption text;

comment on column public.activity_feed.title is
  'Optional user-supplied title shown above the workout stats on the feed card.';
comment on column public.activity_feed.caption is
  'Optional free-text caption displayed below the workout stats on the feed card.';
