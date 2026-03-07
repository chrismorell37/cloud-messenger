import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appUserId = typeof req.query.app_user_id === 'string' ? req.query.app_user_id : null
  if (!appUserId) {
    return res.status(400).json({ error: 'Missing app_user_id' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const resFetch = await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users?app_user_id=eq.${encodeURIComponent(appUserId)}&select=playlist_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )

  if (!resFetch.ok) {
    return res.status(500).json({ connected: false })
  }

  const rows = (await resFetch.json()) as { playlist_id: string | null }[]
  const row = rows[0]

  if (!row) {
    return res.status(200).json({ connected: false })
  }

  return res.status(200).json({
    connected: true,
    playlist_id: row.playlist_id ?? null,
  })
}
