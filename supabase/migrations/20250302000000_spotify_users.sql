-- Spotify OAuth tokens and playlist per app user (editor or chat user).
-- Only serverless APIs use this table (with service role). Frontend never sees tokens.
create table if not exists public.spotify_users (
  app_user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  playlist_id text,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table public.spotify_users disable row level security;

comment on table public.spotify_users is 'Spotify OAuth tokens keyed by app user (e.g. editor, chat_user1, chat_user2). Backend only.';
