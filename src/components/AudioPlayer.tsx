import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef, useCallback } from 'react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'

export function AudioPlayer({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { src, played, reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'

  const handlePlay = () => {
    if (!played) {
      updateAttributes({ played: true })
    }
  }

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
    <NodeViewWrapper className="audio-player-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={handleDelete}
        onReply={handleReply}
        userId={userId}
      >
        <div className="relative">
          {!played && (
            <span className="audio-new-badge">
              New!
            </span>
          )}
          <audio
            ref={audioRef}
            src={src}
            controls
            preload="metadata"
            onPlay={handlePlay}
            className="w-full rounded-lg"
          />
        </div>
      </MediaWrapper>
    </NodeViewWrapper>
  )
}
