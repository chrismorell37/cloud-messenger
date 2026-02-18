export interface SongResult {
  trackId: number
  trackName: string
  artistName: string
  collectionName: string
  artworkUrl100: string
  trackViewUrl: string
  previewUrl?: string
}

export interface SpotifyLinkResult {
  spotifyUrl: string | null
  spotifyUri: string | null
}

/**
 * Search for songs using iTunes Search API (free, no auth required)
 */
export async function searchSongs(query: string): Promise<SongResult[]> {
  if (!query.trim()) return []

  try {
    const params = new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: '10',
    })

    const response = await fetch(
      `https://itunes.apple.com/search?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error('iTunes search failed')
    }

    const data = await response.json()
    return data.results as SongResult[]
  } catch (error) {
    console.error('Error searching songs:', error)
    return []
  }
}

/**
 * Get Spotify URL from any music service URL using our API proxy (avoids CORS issues)
 */
export async function getSpotifyUrl(
  musicUrl: string
): Promise<SpotifyLinkResult> {
  try {
    const params = new URLSearchParams({
      url: musicUrl,
    })

    // Use our serverless function to proxy the request (avoids CORS)
    const response = await fetch(`/api/spotify-link?${params.toString()}`)

    if (!response.ok) {
      console.error('Spotify link API error:', response.status, response.statusText)
      throw new Error('Spotify link API request failed')
    }

    const data = await response.json()
    console.log('Spotify link response:', data)

    return {
      spotifyUrl: data.spotifyUrl || null,
      spotifyUri: data.spotifyUri || null,
    }
  } catch (error) {
    console.error('Error getting Spotify URL:', error)
    return { spotifyUrl: null, spotifyUri: null }
  }
}

/**
 * Search Spotify directly using track name and artist
 * This is a fallback when Odesli doesn't have the link
 * Returns a Spotify search URL that will find the track
 */
export function buildSpotifySearchUrl(trackName: string, artistName: string): string {
  const query = encodeURIComponent(`${trackName} ${artistName}`)
  return `https://open.spotify.com/search/${query}`
}

/**
 * Check if a URL is a Spotify URL
 */
export function isSpotifyUrl(url: string): boolean {
  return (
    url.includes('open.spotify.com/') ||
    url.startsWith('spotify:')
  )
}

/**
 * Extract Spotify track/album/playlist URL from text (for paste detection)
 */
export function extractSpotifyUrl(text: string): string | null {
  // Match Spotify URLs: https://open.spotify.com/track/xxx or spotify:track:xxx
  const urlMatch = text.match(
    /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/[a-zA-Z0-9]+(\?[^\s]*)?/
  )
  if (urlMatch) return urlMatch[0]

  const uriMatch = text.match(
    /spotify:(track|album|playlist|episode|show):[a-zA-Z0-9]+/
  )
  if (uriMatch) return uriMatch[0]

  return null
}
