-- Append-only event log. State is derived by reducing the ordered event log.
-- Safe to run repeatedly (idempotent).

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

-- Add the events table to the Realtime publication if not already a member.
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
