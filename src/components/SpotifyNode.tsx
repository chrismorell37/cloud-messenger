import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'

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

export function SpotifyNode({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { spotifyUri, reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'
  const embedUrl = getSpotifyEmbedUrl(spotifyUri || '')

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

  return (
    <NodeViewWrapper className="spotify-node-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={deleteNode}
        onReply={handleReply}
        userId={userId}
      >
        <iframe
          src={embedUrl}
          width="100%"
          height="80"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ borderRadius: '12px' }}
        />
      </MediaWrapper>
    </NodeViewWrapper>
  )
}
