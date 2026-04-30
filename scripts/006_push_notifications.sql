create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  platform text not null, -- 'web' or 'expo'
  token jsonb not null, -- Stores the Web Push subscription object OR the Expo Push Token string
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

alter table public.push_subscriptions enable row level security;

-- Users can insert and delete their own subscriptions
drop policy if exists "Users can manage their own subscriptions" on public.push_subscriptions;

create policy "Users can manage their own subscriptions" 
on public.push_subscriptions 
for all 
using (user_id = auth.uid());
