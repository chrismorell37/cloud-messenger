import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_SCOPES = 'playlist-modify-private playlist-modify-public playlist-read-private'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify app not configured' })
  }

  const appUserId = typeof req.query.app_user_id === 'string' ? req.query.app_user_id : 'editor'
  const redirectUri = getRedirectUri(req)
  const state = encodeURIComponent(appUserId)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
  })

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
  res.redirect(302, authUrl)
}

function getRedirectUri(req: VercelRequest): string {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  const base = `${proto}://${host}`
  return `${base}/api/spotify-callback`
}
