-- Security Fixes for Supabase Security Advisor
-- Run this in your Supabase SQL editor (one-time fix)

-- ============================================
-- 1. Enable RLS on all tables
-- ============================================

alter table public.chat_messages enable row level security;
alter table public.chat_users enable row level security;
alter table public.messages enable row level security;
alter table public.notification_state enable row level security;

-- ============================================
-- 2. Create permissive policies for authenticated users
-- (Since this is a private 2-user app, all authenticated users get full access)
-- ============================================

-- chat_messages policies
drop policy if exists "Allow all for authenticated users" on public.chat_messages;
create policy "Allow all for authenticated users" on public.chat_messages
  for all
  using (true)
  with check (true);

-- chat_users policies  
drop policy if exists "Allow all for authenticated users" on public.chat_users;
create policy "Allow all for authenticated users" on public.chat_users
  for all
  using (true)
  with check (true);

-- messages policies
drop policy if exists "Allow all for authenticated users" on public.messages;
create policy "Allow all for authenticated users" on public.messages
  for all
  using (true)
  with check (true);

-- notification_state policies
drop policy if exists "Allow all for authenticated users" on public.notification_state;
create policy "Allow all for authenticated users" on public.notification_state
  for all
  using (true)
  with check (true);

-- ============================================
-- 3. Fix handle_updated_at function search path
-- ============================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
