-- Run this in the Supabase SQL editor to create the append-only event log.
-- Security relies on RLS + an unguessable game_id, NOT on hiding the key.

create table public.events (
  id         bigint generated always as identity primary key,
  game_id    text not null,
  type       text not null,
  actor      text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index events_game_idx on public.events (game_id, id);

alter table public.events enable row level security;

create policy "read events"   on public.events for select to anon using (true);
create policy "append events" on public.events for insert to anon with check (true);

alter publication supabase_realtime add table public.events;
