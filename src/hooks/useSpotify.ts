import { useCallback, useEffect } from 'react'
import {
  useSpotifyStore,
  getSpotifyConnectUrl,
  fetchSpotifyStatus,
  fetchSpotifyPlaylists,
  saveSpotifyPlaylist,
  addTrackToSpotifyPlaylist,
} from '../stores/spotifyStore'

export function useSpotify(appUserId: string) {
  const { connected, playlistId, loading, playlistsLoading, setAppUserId, setFromStatus, setLoading, setPlaylistsLoading } =
    useSpotifyStore()

  useEffect(() => {
    setAppUserId(appUserId)
  }, [appUserId, setAppUserId])

  const refetch = useCallback(async () => {
    if (!appUserId) return
    setLoading(true)
    try {
      const status = await fetchSpotifyStatus(appUserId)
      setFromStatus(status.connected, status.playlistId)
    } finally {
      setLoading(false)
    }
  }, [appUserId, setFromStatus, setLoading])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify') === 'ok' && params.get('spotify_user') === appUserId) {
      params.delete('spotify')
      params.delete('spotify_user')
      const newSearch = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''))
      refetch()
    }
  }, [appUserId, refetch])

  const listPlaylists = useCallback(async () => {
    if (!appUserId) return []
    setPlaylistsLoading(true)
    try {
      return await fetchSpotifyPlaylists(appUserId)
    } finally {
      setPlaylistsLoading(false)
    }
  }, [appUserId, setPlaylistsLoading])

  const savePlaylist = useCallback(
    async (playlistId: string) => {
      if (!appUserId) return
      await saveSpotifyPlaylist(appUserId, playlistId)
      await refetch()
    },
    [appUserId, refetch]
  )

  const addToPlaylist = useCallback(
    async (trackUri: string) => {
      if (!appUserId) return { ok: false, error: 'Not signed in' }
      return addTrackToSpotifyPlaylist(appUserId, trackUri)
    },
    [appUserId]
  )

  return {
    connected,
    playlistId,
    loading,
    playlistsLoading,
    connectUrl: getSpotifyConnectUrl(appUserId),
    needPlaylist: connected && !playlistId,
    canAddToPlaylist: connected && !!playlistId,
    refetch,
    listPlaylists,
    savePlaylist,
    addToPlaylist,
  }
}
