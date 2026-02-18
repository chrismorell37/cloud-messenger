# Cloud Messenger

A private, real-time collaborative messaging app for exactly two users. The interface feels like a shared document rather than a traditional chat.

## Features

- **Real-time Collaboration**: See each other's cursors and text updates live
- **Rich Text Editor**: TipTap-powered editor with full formatting support
- **Image & Video Support**: Drag and drop or paste media from iOS photo library
- **Automatic Hyperlinks**: URLs are automatically detected and linked
- **Autosave**: Content saves automatically 2 seconds after you stop typing
- **Dark Mode**: Clean, minimal, private aesthetic
- **Two-User Auth**: Only your two pre-authorized emails can access the app

## Tech Stack

- React 18 + Vite
- TipTap (rich text editor)
- Supabase (Auth, Realtime, PostgreSQL, Storage)
- Tailwind CSS v4
- Zustand (state management)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Run the Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Run the SQL to create all tables, policies, and triggers

### 3. Add Your Two Users

After running the schema, add your two authorized users:

```sql
INSERT INTO public.allowed_users (email, display_name) 
VALUES ('user1@example.com', 'User 1');

INSERT INTO public.allowed_users (email, display_name) 
VALUES ('user2@example.com', 'User 2');
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Development Server

```bash
npm run dev
```

### 7. Sign Up Your Users

1. Open the app and sign up with your first authorized email
2. Repeat for the second user on another device/browser

## Usage

- **Typing**: Just start typing in the editor
- **Formatting**: Use Markdown-style shortcuts or keyboard shortcuts (Ctrl/Cmd + B for bold, etc.)
- **Images**: Drag and drop images or paste from clipboard
- **Videos**: Drag and drop video files (they'll play inline)
- **Links**: URLs are automatically converted to clickable links
- **Presence**: See when the other user is online and where their cursor is

## Project Structure

```
cloud-messenger/
├── src/
│   ├── components/
│   │   ├── Editor.tsx           # Main TipTap editor
│   │   ├── PresenceCursors.tsx  # Cursor display for other user
│   │   └── AuthForm.tsx         # Login/signup form
│   ├── hooks/
│   │   ├── useAutosave.ts       # 2-second debounced save
│   │   ├── usePresence.ts       # Real-time cursor tracking
│   │   └── useSupabase.ts       # Realtime subscriptions & media upload
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── extensions.ts        # Custom TipTap extensions (Video)
│   ├── stores/
│   │   └── editorStore.ts       # Zustand state store
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Tailwind styles
├── supabase/
│   └── schema.sql               # Database schema
└── .env.example                 # Environment template
```

## Deployment

Build for production:

```bash
npm run build
```

Deploy the `dist` folder to any static hosting (Vercel, Netlify, Cloudflare Pages, etc.)

## Security Notes

- Only emails listed in `allowed_users` can access the app
- Row Level Security (RLS) policies protect all data at the database level
- Media files are publicly accessible (by URL) but the URLs are not guessable
