-- ============================================================================
-- reactions RLS — allow authenticated users to read all reactions on visible
-- activities and to insert/delete only their own reactions.
--
-- Previously the table had restrictive RLS that blocked SELECT for everyone,
-- so feed posts always showed 0 likes even though INSERTs succeeded and
-- notifications fired.
-- ============================================================================

alter table public.reactions enable row level security;

drop policy if exists "reactions: read all" on public.reactions;
create policy "reactions: read all"
  on public.reactions
  for select
  to authenticated
  using (true);

drop policy if exists "reactions: insert own" on public.reactions;
create policy "reactions: insert own"
  on public.reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reactions: delete own" on public.reactions;
create policy "reactions: delete own"
  on public.reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.reactions to authenticated;
