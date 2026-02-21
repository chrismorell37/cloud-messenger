import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback, useState, useRef, useEffect } from 'react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'

export function ImageGalleryNode({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { images = [], reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const scrollLeft = container.scrollLeft
    const itemWidth = container.offsetWidth
    const newIndex = Math.round(scrollLeft / itemWidth)
    setCurrentIndex(newIndex)
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const scrollToIndex = (index: number) => {
    const container = scrollContainerRef.current
    if (!container) return
    
    container.scrollTo({
      left: index * container.offsetWidth,
      behavior: 'smooth',
    })
  }

  if (!images || images.length === 0) {
    return null
  }

  return (
    <NodeViewWrapper className="image-gallery-node-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={handleDelete}
        onReply={handleReply}
        userId={userId}
      >
        <div className="image-gallery-container">
          <div 
            ref={scrollContainerRef}
            className="image-gallery-scroll"
          >
            {images.map((src: string, index: number) => (
              <div key={index} className="image-gallery-item">
                <img
                  src={src}
                  alt={`Image ${index + 1}`}
                  className="image-gallery-image"
                  draggable={false}
                />
              </div>
            ))}
          </div>
          
          {images.length > 1 && (
            <div className="image-gallery-dots">
              {images.map((_: string, index: number) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    scrollToIndex(index)
                  }}
                  className={`image-gallery-dot ${index === currentIndex ? 'active' : ''}`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          )}
          
          {images.length > 1 && (
            <div className="image-gallery-counter">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </MediaWrapper>
    </NodeViewWrapper>
  )
}
