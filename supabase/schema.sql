-- Append-only event log for the game. Security relies on RLS + an unguessable
-- game_id, NOT on hiding the key. Safe to run repeatedly (idempotent), so it
-- works both pasted into the Supabase SQL editor and via the db-migrate Action.

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  game_id    text not null,
  type       text not null,
  actor      text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists events_game_idx on public.events (game_id, id);

alter table public.events enable row level security;

drop policy if exists "read events" on public.events;
create policy "read events" on public.events for select to anon using (true);

drop policy if exists "append events" on public.events;
create policy "append events" on public.events for insert to anon with check (true);

-- Add the table to the realtime publication only if it isn't already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
