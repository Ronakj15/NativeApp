create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  filters jsonb not null,
  audience_count integer not null,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

create policy "Faculty can manage their own broadcasts"
on public.broadcasts
for all
using (faculty_id = auth.uid());

alter table public.notifications
add column if not exists broadcast_id uuid references public.broadcasts(id) on delete cascade;
