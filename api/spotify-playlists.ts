import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SpotifyUserRow {
  app_user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface SpotifyPlaylistItem {
  id: string
  name: string
  uri: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleList(req, res)
  }
  if (req.method === 'POST') {
    return handleSavePlaylist(req, res)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  const appUserId = typeof req.query.app_user_id === 'string' ? req.query.app_user_id : null
  if (!appUserId) {
    return res.status(400).json({ error: 'Missing app_user_id' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const row = await getSpotifyUser(appUserId)
  if (!row) {
    return res.status(401).json({ error: 'Spotify not connected' })
  }

  let accessToken = row.access_token
  if (new Date(row.expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(row.refresh_token)
    if (!refreshed) {
      return res.status(401).json({ error: 'Spotify session expired. Connect again.' })
    }
    accessToken = refreshed.access_token
    await updateTokens(appUserId, refreshed.access_token, refreshed.expires_at)
  }

  const playlists: SpotifyPlaylistItem[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url) {
    const listRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!listRes.ok) {
      return res.status(listRes.status).json({ error: 'Failed to fetch playlists' })
    }
    const data = (await listRes.json()) as {
      items: Array<{ id: string; name: string; uri: string }>
      next: string | null
    }
    for (const p of data.items) {
      playlists.push({ id: p.id, name: p.name, uri: p.uri })
    }
    url = data.next
  }

  return res.status(200).json({ playlists })
}

async function handleSavePlaylist(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { app_user_id?: string; playlist_id?: string } | null
  const appUserId = body?.app_user_id
  const playlistId = body?.playlist_id

  if (!appUserId || typeof appUserId !== 'string') {
    return res.status(400).json({ error: 'Missing app_user_id' })
  }
  if (!playlistId || typeof playlistId !== 'string') {
    return res.status(400).json({ error: 'Missing playlist_id' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const resPatch = await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users?app_user_id=eq.${encodeURIComponent(appUserId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        playlist_id: playlistId,
        updated_at: new Date().toISOString(),
      }),
    }
  )

  if (!resPatch.ok) {
    return res.status(500).json({ error: 'Failed to save playlist' })
  }

  return res.status(200).json({ ok: true })
}

async function getSpotifyUser(appUserId: string): Promise<SpotifyUserRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users?app_user_id=eq.${encodeURIComponent(appUserId)}&select=app_user_id,access_token,refresh_token,expires_at`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )
  if (!res.ok) return null
  const rows = (await res.json()) as SpotifyUserRow[]
  return rows[0] ?? null
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: body.toString(),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token: string; expires_in: number }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  return { access_token: data.access_token, expires_at: expiresAt }
}

async function updateTokens(appUserId: string, accessToken: string, expiresAt: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users?app_user_id=eq.${encodeURIComponent(appUserId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        access_token: accessToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    }
  )
}
