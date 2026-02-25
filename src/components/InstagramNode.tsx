import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback } from 'react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'
import { getInstagramEmbedUrl, getInstagramContentType } from '../lib/instagramExtension'

export function InstagramNode({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { instagramUrl, reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'
  const embedUrl = getInstagramEmbedUrl(instagramUrl || '')
  const contentType = getInstagramContentType(instagramUrl || '')
  const embedHeight = contentType === 'reel' ? 700 : 540

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

  return (
    <NodeViewWrapper className="instagram-node-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={handleDelete}
        onReply={handleReply}
        userId={userId}
      >
        <div className="instagram-embed-container">
          <iframe
            src={embedUrl}
            width="100%"
            height={embedHeight}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            loading="lazy"
            style={{ 
              borderRadius: '12px', 
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}
          />
        </div>
      </MediaWrapper>
    </NodeViewWrapper>
  )
}
