import { useState, useRef, useCallback, type ReactNode } from 'react'
import { MediaContextMenu } from './MediaContextMenu'

export interface Reaction {
  emoji: string
  userIds: string[]
}

export interface Reply {
  id: string
  text: string
  userId: string
  userName: string
  timestamp: number
}

interface MediaWrapperProps {
  children: ReactNode
  reactions?: Record<string, string[]>
  replies?: Reply[]
  onAddReaction: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
  onDelete: () => void
  onReply: (text: string) => void
  userId: string
  mediaUrl?: string
}

const DOUBLE_TAP_DELAY = 300
const LONG_PRESS_DELAY = 800
const DEFAULT_REACTION = '🩵'

export function MediaWrapper({
  children,
  reactions = {},
  replies = [],
  onAddReaction,
  onRemoveReaction,
  onDelete,
  onReply,
  userId,
  mediaUrl,
}: MediaWrapperProps) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isThreadExpanded, setIsThreadExpanded] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  
  const lastTapRef = useRef<number>(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = useRef(false)

  const clearAllTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsPressing(false)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    isLongPressRef.current = false

    // Show menu with wiggle after LONG_PRESS_DELAY
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setIsPressing(true)
      setShowContextMenu(true)
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
      // Reset wiggle animation after it plays
      setTimeout(() => setIsPressing(false), 150)
    }, LONG_PRESS_DELAY)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)
    
    if (dx > 10 || dy > 10) {
      clearAllTimers()
    }
  }, [clearAllTimers])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearAllTimers()
    
    if (isLongPressRef.current) {
      e.preventDefault()
      return
    }

    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current
    
    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      e.preventDefault()
      const hasReacted = reactions[DEFAULT_REACTION]?.includes(userId)
      if (hasReacted) {
        onRemoveReaction(DEFAULT_REACTION)
      } else {
        onAddReaction(DEFAULT_REACTION)
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [reactions, userId, onAddReaction, onRemoveReaction, clearAllTimers])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowContextMenu(true)
  }, [])

  const handleReactionSelect = useCallback((emoji: string) => {
    const hasReacted = reactions[emoji]?.includes(userId)
    if (hasReacted) {
      onRemoveReaction(emoji)
    } else {
      onAddReaction(emoji)
    }
    setShowContextMenu(false)
  }, [reactions, userId, onAddReaction, onRemoveReaction])

  const handleReplySubmit = useCallback(() => {
    if (replyText.trim()) {
      onReply(replyText.trim())
      setReplyText('')
      setShowReplyInput(false)
      setIsThreadExpanded(true)
    }
  }, [replyText, onReply])

  const handleSave = useCallback(async () => {
    if (!mediaUrl) return
    
    try {
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      
      // Determine file extension from mime type
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
      }
      const ext = mimeToExt[blob.type] || 'file'
      const filename = `pinkblue-${Date.now()}.${ext}`
      
      const file = new File([blob], filename, { type: blob.type })
      
      // Try Web Share API first (works on iOS)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        // Fallback: direct download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
    setShowContextMenu(false)
  }, [mediaUrl])

  const reactionEntries = Object.entries(reactions).filter(([, userIds]) => userIds.length > 0)

  return (
    <div className="media-wrapper">
      <div
        className={`media-content ${isPressing ? 'pressing' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        {children}
        
        {/* Reactions display - overlapping bottom-left of media */}
        {reactionEntries.length > 0 && (
          <div className="media-reactions">
            {reactionEntries.map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation()
                  handleReactionSelect(emoji)
                }}
                className={`reaction-badge ${userIds.includes(userId) ? 'reaction-badge-mine' : ''}`}
              >
                <span className="reaction-emoji">{emoji}</span>
                {userIds.length > 1 && (
                  <span className="reaction-count">{userIds.length}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thread replies */}
      {replies.length > 0 && (
        <div className="media-thread">
          <button
            onClick={() => setIsThreadExpanded(!isThreadExpanded)}
            className="thread-toggle"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`thread-arrow ${isThreadExpanded ? 'expanded' : ''}`}
            >
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
          </button>
          
          {isThreadExpanded && (
            <div className="thread-replies">
              {replies.map((reply) => (
                <div key={reply.id} className="thread-reply">
                  <span className="reply-author">{reply.userName}</span>
                  <span className="reply-text">{reply.text}</span>
                  <span className="reply-time">
                    {new Date(reply.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="reply-input-container">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="reply-input"
            autoFocus
            onBlur={() => {
              if (!replyText.trim()) {
                setShowReplyInput(false)
                setReplyText('')
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleReplySubmit()
              } else if (e.key === 'Escape') {
                setShowReplyInput(false)
                setReplyText('')
              }
            }}
          />
          <button onClick={handleReplySubmit} className="reply-submit" disabled={!replyText.trim()}>
            Send
          </button>
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && (
        <MediaContextMenu
          reactions={reactions}
          userId={userId}
          onReactionSelect={handleReactionSelect}
          onReply={() => {
            setShowContextMenu(false)
            setShowReplyInput(true)
          }}
          onSave={mediaUrl ? handleSave : undefined}
          onDelete={() => {
            setShowContextMenu(false)
            onDelete()
          }}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </div>
  )
}
