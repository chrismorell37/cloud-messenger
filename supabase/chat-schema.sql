-- Chat Mode Database Schema
-- Run this in your Supabase SQL editor AFTER the main schema.sql
-- This creates separate tables for chat mode (iMessage-style)

-- Chat messages table - individual messages instead of shared document
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id text not null check (sender_id in ('user1', 'user2')),
  content jsonb not null default '{}',
  message_type text not null default 'text' check (message_type in ('text', 'image', 'video', 'audio', 'spotify', 'instagram', 'gallery')),
  media_url text,
  reactions jsonb default '{}',
  reply_to uuid references public.chat_messages(id) on delete set null,
  is_deleted boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat users table - simple two-user system
create table if not exists public.chat_users (
  id text primary key check (id in ('user1', 'user2')),
  display_name text not null,
  created_at timestamp with time zone default now()
);

-- Disable Row Level Security (using simple password auth)
alter table public.chat_messages disable row level security;
alter table public.chat_users disable row level security;

-- Create trigger for auto-updating updated_at on chat_messages
drop trigger if exists on_chat_messages_update on public.chat_messages;
create trigger on_chat_messages_update
  before update on public.chat_messages
  for each row
  execute function public.handle_updated_at();

-- Enable Realtime for chat_messages table
alter publication supabase_realtime add table public.chat_messages;

-- Insert default users (you can update display names later)
insert into public.chat_users (id, display_name)
values 
  ('user1', 'User 1'),
  ('user2', 'User 2')
on conflict (id) do nothing;

-- Create indexes for better query performance
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at desc);
create index if not exists idx_chat_messages_sender_id on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_reply_to on public.chat_messages(reply_to);

-- IMPORTANT: After running this script, update user display names:
-- UPDATE public.chat_users SET display_name = 'Chris' WHERE id = 'user1';
-- UPDATE public.chat_users SET display_name = 'Partner' WHERE id = 'user2';
