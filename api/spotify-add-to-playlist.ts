import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SpotifyUserRow {
  app_user_id: string
  access_token: string
  refresh_token: string
  playlist_id: string | null
  expires_at: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body as { trackUri?: string; app_user_id?: string } | null
  const trackUri = body?.trackUri
  const appUserId = body?.app_user_id

  if (!trackUri || typeof trackUri !== 'string') {
    return res.status(400).json({ error: 'Missing trackUri' })
  }
  if (!appUserId || typeof appUserId !== 'string') {
    return res.status(400).json({ error: 'Missing app_user_id' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const row = await getSpotifyUser(appUserId)
  if (!row) {
    return res.status(401).json({ error: 'Spotify not connected. Connect Spotify first.' })
  }
  if (!row.playlist_id) {
    return res.status(400).json({ error: 'No playlist selected. Choose a playlist first.' })
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

  const uri = normalizeTrackUri(trackUri)
  if (!uri) {
    return res.status(400).json({ error: 'Invalid track URI' })
  }

  const addRes = await fetch(
    `https://api.spotify.com/v1/playlists/${row.playlist_id}/tracks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ uris: [uri] }),
    }
  )

  if (!addRes.ok) {
    const err = await addRes.text()
    console.error('Spotify add tracks failed:', addRes.status, err)
    if (addRes.status === 401) {
      return res.status(401).json({ error: 'Spotify session expired. Connect again.' })
    }
    return res.status(addRes.status).json({ error: 'Failed to add to playlist' })
  }

  return res.status(200).json({ ok: true })
}

async function getSpotifyUser(appUserId: string): Promise<SpotifyUserRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users?app_user_id=eq.${encodeURIComponent(appUserId)}&select=*`,
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

function normalizeTrackUri(input: string): string | null {
  const trimmed = input.trim()
  if (/^spotify:track:[a-zA-Z0-9]+$/.test(trimmed)) return trimmed
  const m = trimmed.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)
  if (m) return `spotify:track:${m[1]}`
  return null
}
