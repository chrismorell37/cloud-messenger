-- Cloud Messenger Database Schema
-- Run this in your Supabase SQL editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Users table (managed by Supabase Auth, but we track app-specific data)
-- Add your two user emails here after creating the table
create table if not exists public.allowed_users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  display_name text,
  created_at timestamp with time zone default now()
);

-- Messages/Document content table
-- This stores the shared document content as TipTap JSON
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  content jsonb not null default '{"type": "doc", "content": [{"type": "paragraph"}]}',
  html_content text,
  user_id uuid references auth.users(id),
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Media attachments (for tracking uploaded image/video URLs)
create table if not exists public.media (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references public.messages(id) on delete cascade,
  file_path text not null,
  file_type text not null check (file_type in ('image', 'video')),
  created_at timestamp with time zone default now()
);

-- Disable Row Level Security (using simple password auth instead of Supabase Auth)
alter table public.messages disable row level security;
alter table public.media disable row level security;
alter table public.allowed_users disable row level security;

-- Drop existing policies if they exist (for re-running the script)
drop policy if exists "Allowed users can read messages" on public.messages;
drop policy if exists "Allowed users can insert messages" on public.messages;
drop policy if exists "Allowed users can update messages" on public.messages;
drop policy if exists "Allowed users can read media" on public.media;
drop policy if exists "Allowed users can insert media" on public.media;
drop policy if exists "Allowed users can read allowed_users" on public.allowed_users;

-- RLS Policies: Only allowed users can read/write messages
create policy "Allowed users can read messages"
  on public.messages for select
  using (
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

create policy "Allowed users can insert messages"
  on public.messages for insert
  with check (
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

create policy "Allowed users can update messages"
  on public.messages for update
  using (
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

-- RLS Policies for media
create policy "Allowed users can read media"
  on public.media for select
  using (
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

create policy "Allowed users can insert media"
  on public.media for insert
  with check (
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

-- Allow authenticated users to read allowed_users (to check if they have access)
create policy "Allowed users can read allowed_users"
  on public.allowed_users for select
  using (auth.role() = 'authenticated');

-- Enable Realtime for messages table
alter publication supabase_realtime add table public.messages;

-- Create a function to auto-update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for auto-updating updated_at
drop trigger if exists on_messages_update on public.messages;
create trigger on_messages_update
  before update on public.messages
  for each row
  execute function public.handle_updated_at();

-- Create storage bucket for media files
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Storage policies for media bucket
drop policy if exists "Allowed users can upload media" on storage.objects;
drop policy if exists "Anyone can view media" on storage.objects;

create policy "Allowed users can upload media"
  on storage.objects for insert
  with check (
    bucket_id = 'media' and
    auth.uid() in (
      select au.id from auth.users au 
      where au.email in (select email from public.allowed_users)
    )
  );

create policy "Anyone can view media"
  on storage.objects for select
  using (bucket_id = 'media');

-- Insert a default shared document (you'll use this single document ID)
insert into public.messages (id, content)
values (
  '00000000-0000-0000-0000-000000000001',
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Welcome to your private messenger. Start typing..."}]}]}'
)
on conflict (id) do nothing;

-- Notification state table for rate limiting email notifications
create table if not exists public.notification_state (
  id text primary key default 'default',
  last_sent_at timestamp with time zone
);

-- Disable RLS for notification_state
alter table public.notification_state disable row level security;

-- Insert default row
insert into public.notification_state (id, last_sent_at)
values ('default', null)
on conflict (id) do nothing;

-- IMPORTANT: After running this script, add your two users to allowed_users:
-- INSERT INTO public.allowed_users (email, display_name) VALUES ('user1@example.com', 'User 1');
-- INSERT INTO public.allowed_users (email, display_name) VALUES ('user2@example.com', 'User 2');
