import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const params = new URLSearchParams({ url })
    const response = await fetch(
      `https://api.song.link/v1-alpha.1/links?${params.toString()}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Odesli API error' })
    }

    const data = await response.json()
    
    // Extract Spotify link
    const spotifyLink = data.linksByPlatform?.spotify
    
    if (spotifyLink) {
      return res.status(200).json({
        spotifyUrl: spotifyLink.url,
        spotifyUri: spotifyLink.nativeAppUriDesktop || null,
      })
    }

    return res.status(200).json({
      spotifyUrl: null,
      spotifyUri: null,
    })
  } catch (error) {
    console.error('Error fetching Spotify link:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
