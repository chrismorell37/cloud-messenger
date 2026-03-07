import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = typeof req.query.code === 'string' ? req.query.code : null
  const state = typeof req.query.state === 'string' ? req.query.state : null

  if (!code || !state) {
    return redirectToApp(res, false, 'missing_params', req)
  }

  const appUserId = decodeURIComponent(state)
  if (!appUserId) {
    return redirectToApp(res, false, 'invalid_state', req)
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return redirectToApp(res, false, 'server_config', req)
  }

  const redirectUri = getRedirectUri(req)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: body.toString(),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('Spotify token exchange failed:', tokenRes.status, err)
    return redirectToApp(res, false, 'token_exchange', req)
  }

  const data = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  const upsertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/spotify_users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        app_user_id: appUserId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    }
  )

  if (!upsertRes.ok) {
    const err = await upsertRes.text()
    console.error('Supabase upsert failed:', err)
    return redirectToApp(res, false, 'db_error', req)
  }

  return redirectToApp(res, true, appUserId, req)
}

function getRedirectUri(req: VercelRequest): string {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  return `${proto}://${host}/api/spotify-callback`
}

function redirectToApp(
  res: VercelResponse,
  success: boolean,
  value: string,
  req: VercelRequest
) {
  const host = (req.headers['x-forwarded-host'] as string) ?? req.headers.host ?? 'localhost:5173'
  const proto = (req.headers['x-forwarded-proto'] as string) === 'https' ? 'https' : 'http'
  const base = `${proto}://${host}`
  const url = new URL('/', base)
  url.searchParams.set('spotify', success ? 'ok' : 'error')
  if (value && value !== 'ok' && value !== 'error') {
    url.searchParams.set('spotify_user', value)
  }
  res.redirect(302, url.pathname + '?' + url.searchParams.toString())
}
