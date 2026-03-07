import { create } from 'zustand'

interface SpotifyState {
  appUserId: string
  connected: boolean
  playlistId: string | null
  loading: boolean
  playlistsLoading: boolean
  setAppUserId: (id: string) => void
  setFromStatus: (connected: boolean, playlistId: string | null) => void
  setLoading: (loading: boolean) => void
  setPlaylistsLoading: (loading: boolean) => void
}

export const useSpotifyStore = create<SpotifyState>((set) => ({
  appUserId: 'editor',
  connected: false,
  playlistId: null,
  loading: false,
  playlistsLoading: false,
  setAppUserId: (appUserId) => set({ appUserId }),
  setFromStatus: (connected, playlistId) => set({ connected, playlistId }),
  setLoading: (loading) => set({ loading }),
  setPlaylistsLoading: (playlistsLoading) => set({ playlistsLoading }),
}))

export function getSpotifyConnectUrl(appUserId: string): string {
  return `/api/spotify-auth?app_user_id=${encodeURIComponent(appUserId)}`
}

export async function fetchSpotifyStatus(appUserId: string): Promise<{ connected: boolean; playlistId: string | null }> {
  const res = await fetch(`/api/spotify-status?app_user_id=${encodeURIComponent(appUserId)}`)
  const data = await res.json()
  if (data.connected) {
    return { connected: true, playlistId: data.playlist_id ?? null }
  }
  return { connected: false, playlistId: null }
}

export async function fetchSpotifyPlaylists(appUserId: string): Promise<Array<{ id: string; name: string; uri: string }>> {
  const res = await fetch(`/api/spotify-playlists?app_user_id=${encodeURIComponent(appUserId)}`)
  if (!res.ok) throw new Error('Failed to load playlists')
  const data = await res.json()
  return data.playlists ?? []
}

export async function saveSpotifyPlaylist(appUserId: string, playlistId: string): Promise<void> {
  const res = await fetch('/api/spotify-playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_user_id: appUserId, playlist_id: playlistId }),
  })
  if (!res.ok) throw new Error('Failed to save playlist')
}

export async function addTrackToSpotifyPlaylist(
  appUserId: string,
  trackUri: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/spotify-add-to-playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_user_id: appUserId, trackUri }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data.error as string) || 'Something went wrong. Try again or connect/choose playlist in the header.'
    return { ok: false, error: message }
  }
  return { ok: true }
}
