import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback, useState } from 'react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'
import { useSpotifyStore, getSpotifyConnectUrl, addTrackToSpotifyPlaylist } from '../stores/spotifyStore'

function getSpotifyEmbedUrl(spotifyUri: string): string {
  if (spotifyUri.startsWith('spotify:')) {
    const parts = spotifyUri.split(':')
    if (parts.length >= 3) {
      return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`
    }
  } else if (spotifyUri.includes('open.spotify.com')) {
    let embedUrl = spotifyUri.replace('open.spotify.com/', 'open.spotify.com/embed/')
    return embedUrl.split('?')[0]
  }
  return ''
}

function getSpotifyContentType(spotifyUri: string): 'track' | 'playlist' | 'album' | 'other' {
  if (spotifyUri.includes('/playlist/') || spotifyUri.includes(':playlist:')) return 'playlist'
  if (spotifyUri.includes('/album/') || spotifyUri.includes(':album:')) return 'album'
  if (spotifyUri.includes('/track/') || spotifyUri.includes(':track:')) return 'track'
  return 'other'
}

export function SpotifyNode({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { spotifyUri, reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'
  const embedUrl = getSpotifyEmbedUrl(spotifyUri || '')
  const contentType = getSpotifyContentType(spotifyUri || '')
  const embedHeight = contentType === 'playlist' || contentType === 'album' ? 352 : 80
  const { appUserId, connected, playlistId } = useSpotifyStore()
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleAddReaction = (emoji: string) => {
    const currentReactions = { ...reactions }
    if (!currentReactions[emoji]) {
      currentReactions[emoji] = []
    }
    if (!currentReactions[emoji].includes(userId)) {
      currentReactions[emoji] = [...currentReactions[emoji], userId]
      updateAttributes({ reactions: currentReactions })
    }
  }

  const handleRemoveReaction = (emoji: string) => {
    const currentReactions = { ...reactions }
    if (currentReactions[emoji]) {
      currentReactions[emoji] = currentReactions[emoji].filter((id: string) => id !== userId)
      if (currentReactions[emoji].length === 0) {
        delete currentReactions[emoji]
      }
      updateAttributes({ reactions: currentReactions })
    }
  }

  const handleReply = (text: string) => {
    const newReply: Reply = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text,
      userId,
      userName,
      timestamp: Date.now(),
    }
    updateAttributes({ replies: [...replies, newReply] })
  }

  const handleDelete = useCallback(() => {
    const pos = getPos()
    if (typeof pos === 'number' && editor) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    }
  }, [editor, getPos, node.nodeSize])

  const handleAddToPlaylist = useCallback(async () => {
    if (contentType !== 'track' || !spotifyUri) return
    if (!connected) {
      window.location.href = getSpotifyConnectUrl(appUserId)
      return
    }
    if (!playlistId) {
      alert('Choose a playlist first. Use the Spotify option in the menu.')
      return
    }
    setAddStatus('loading')
    const result = await addTrackToSpotifyPlaylist(appUserId, spotifyUri)
    setAddStatus(result.ok ? 'done' : 'error')
    if (!result.ok) alert(result.error ?? 'Something went wrong. Try again or connect/choose playlist in the menu.')
    setTimeout(() => setAddStatus('idle'), 2000)
  }, [contentType, spotifyUri, connected, playlistId, appUserId])

  return (
    <NodeViewWrapper className="spotify-node-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={handleDelete}
        onReply={handleReply}
        userId={userId}
      >
        <div className="spotify-embed-container">
          <iframe
            src={embedUrl}
            width="100%"
            height={embedHeight}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ borderRadius: '12px' }}
          />
          {contentType === 'track' && (
            <div className="mt-2 flex flex-col gap-1">
              <button
                type="button"
                onClick={handleAddToPlaylist}
                disabled={addStatus === 'loading'}
                className="text-sm font-medium px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 transition-colors w-fit"
              >
                {addStatus === 'loading' ? 'Adding…' : addStatus === 'done' ? 'Added' : 'Add to my playlist'}
              </button>
              {!connected && (
                <p className="text-xs text-dark-muted">
                  Connect Spotify and choose a playlist via + → Add Song (at the top of that panel).
                </p>
              )}
            </div>
          )}
        </div>
      </MediaWrapper>
    </NodeViewWrapper>
  )
}
