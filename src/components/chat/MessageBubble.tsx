import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useChatStore, type ChatMessage } from '../../stores/chatStore'
import { MediaContextMenu } from '../MediaContextMenu'

interface MessageBubbleProps {
  message: ChatMessage
  onAddReaction: (messageId: string, emoji: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, newText: string) => void
  showTimestamp?: boolean
  allMessages: ChatMessage[]
}

export function MessageBubble({ 
  message, 
  onAddReaction, 
  onDelete,
  onEdit,
  showTimestamp = false,
  allMessages = []
}: MessageBubbleProps) {
  const { currentUser, setLightboxImage, setReplyingTo } = useChatStore()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.content.text || '')
  const [galleryIndex, setGalleryIndex] = useState(0)
  const galleryScrollRef = useRef<HTMLDivElement>(null)
  
  const isOwnMessage = message.sender_id === currentUser?.id
  const senderName = message.sender_id === 'user1' ? 'S' : 'C'
  
  // Find the message being replied to
  const repliedToMessage = message.reply_to 
    ? allMessages.find(m => m.id === message.reply_to) 
    : null

  const formattedTime = useMemo(() => {
    const date = new Date(message.created_at)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }, [message.created_at])

  const handleReactionSelect = useCallback((emoji: string) => {
    onAddReaction(message.id, emoji)
    setShowContextMenu(false)
  }, [message.id, onAddReaction])

  const handleLongPress = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    setShowContextMenu(true)
  }, [])

  const handleDoubleTap = useCallback(() => {
    if (message.message_type === 'image' && message.media_url) {
      setLightboxImage(message.media_url)
    } else if (message.message_type === 'gallery') {
      const images = (message.content.attrs?.images as string[]) || []
      if (images[galleryIndex]) {
        setLightboxImage(images[galleryIndex])
      }
    } else {
      onAddReaction(message.id, '🩵')
    }
  }, [message, onAddReaction, setLightboxImage, galleryIndex])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
    setEditText(message.content.text || '')
    setShowContextMenu(false)
  }, [message.content.text])

  const handleReply = useCallback(() => {
    setReplyingTo(message)
    setShowContextMenu(false)
  }, [message, setReplyingTo])

  const handleCopy = useCallback(() => {
    const textToCopy = message.content.text || ''
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch(console.error)
    }
    setShowContextMenu(false)
  }, [message.content.text])

  const handleEditSave = useCallback(() => {
    if (editText.trim() && editText.trim() !== message.content.text) {
      onEdit(message.id, editText.trim())
    }
    setIsEditing(false)
  }, [editText, message.id, message.content.text, onEdit])

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
    setEditText(message.content.text || '')
  }, [message.content.text])

  const handleGalleryScroll = useCallback(() => {
    if (galleryScrollRef.current) {
      const { scrollLeft, clientWidth } = galleryScrollRef.current
      setGalleryIndex(Math.round(scrollLeft / clientWidth))
    }
  }, [])

  const renderContent = () => {
    switch (message.message_type) {
      case 'text':
        if (isEditing) {
          return (
            <div className="bubble-edit-inline">
              <div className="bubble-edit-row">
                <button onClick={handleEditCancel} className="bubble-edit-btn cancel">
                  Cancel
                </button>
                <button onClick={handleEditSave} className="bubble-edit-btn save">
                  Save
                </button>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="bubble-edit-textarea"
                autoFocus
              />
            </div>
          )
        }
        return (
          <p className="bubble-text">
            {message.content.text || ''}
            {message.updated_at !== message.created_at && (
              <span className="bubble-edited">(edited)</span>
            )}
          </p>
        )
      
      case 'image':
        return (
          <img 
            src={message.media_url || ''} 
            alt="Shared image"
            className="bubble-image"
            onClick={() => message.media_url && setLightboxImage(message.media_url)}
          />
        )
      
      case 'gallery': {
        const images = (message.content.attrs?.images as string[]) || []
        return (
          <div className="bubble-gallery-container">
            <div 
              ref={galleryScrollRef}
              className="bubble-gallery-scroll"
              onScroll={handleGalleryScroll}
            >
              {images.map((src, idx) => (
                <div key={idx} className="bubble-gallery-item">
                  <img 
                    src={src} 
                    alt={`Gallery image ${idx + 1}`}
                    className="bubble-gallery-image"
                    onClick={() => setLightboxImage(src)}
                  />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="bubble-gallery-dots">
                {images.map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`bubble-gallery-dot ${idx === galleryIndex ? 'active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        )
      }
      
      case 'video':
        return (
          <video 
            src={message.media_url || ''} 
            controls 
            playsInline
            className="bubble-video"
          />
        )
      
      case 'audio': {
        const transcription = message.content.attrs?.transcription as string | undefined
        return (
          <div className="bubble-audio">
            <audio 
              src={message.media_url || ''} 
              controls 
              className="w-full"
            />
            {transcription && (
              <p className="bubble-transcription">
                {transcription}
              </p>
            )}
          </div>
        )
      }
      
      case 'spotify': {
        const spotifyUri = message.content.attrs?.spotifyUri as string
        if (!spotifyUri) return null
        const embedUrl = spotifyUri.includes('spotify.com') 
          ? spotifyUri.replace('open.spotify.com', 'open.spotify.com/embed')
          : `https://open.spotify.com/embed/${spotifyUri.replace('spotify:', '').replace(/:/g, '/')}`
        return (
          <iframe
            src={embedUrl}
            width="100%"
            height="80"
            frameBorder="0"
            allow="encrypted-media"
            className="bubble-spotify rounded-lg"
          />
        )
      }
      
      case 'instagram': {
        const instaUrl = message.content.attrs?.instagramUrl as string
        if (!instaUrl) return null
        const embedInstaUrl = `${instaUrl}embed`
        return (
          <iframe
            src={embedInstaUrl}
            width="100%"
            height="500"
            frameBorder="0"
            scrolling="no"
            className="bubble-instagram rounded-lg"
          />
        )
      }
      
      default:
        return null
    }
  }

  const reactionEntries = Object.entries(message.reactions || {}).filter(([, userIds]) => userIds.length > 0)

  return (
    <div className={`message-bubble-container ${isOwnMessage ? 'own' : 'other'}`}>
      {showTimestamp && (
        <div className="message-timestamp-divider">
          {new Date(message.created_at).toLocaleDateString([], { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
      )}
      
      {!isOwnMessage && (
        <span className="message-sender-name">{senderName}</span>
      )}
      
      {repliedToMessage && (
        <div 
          className="reply-thread-container"
          style={{ alignSelf: repliedToMessage.sender_id === currentUser?.id ? 'flex-end' : 'flex-start' }}
        >
          <div className="reply-quoted-bubble">
            <span className="reply-quoted-text">
              {repliedToMessage.message_type === 'text' 
                ? (repliedToMessage.content.text || '').slice(0, 60) + ((repliedToMessage.content.text || '').length > 60 ? '...' : '')
                : repliedToMessage.message_type === 'image' ? 'Photo'
                : repliedToMessage.message_type === 'video' ? 'Video'
                : repliedToMessage.message_type === 'audio' ? 'Voice note'
                : repliedToMessage.message_type === 'spotify' ? 'Spotify'
                : repliedToMessage.message_type === 'gallery' ? 'Photo album'
                : 'Message'}
            </span>
          </div>
          <svg 
            className="reply-connector" 
            viewBox="0 0 24 32" 
            fill="none"
            style={{ 
              [repliedToMessage.sender_id === currentUser?.id ? 'right' : 'left']: '8px'
            }}
          >
            <path 
              d={repliedToMessage.sender_id === currentUser?.id 
                ? "M12 0 L12 16 Q12 28 2 28" 
                : "M12 0 L12 16 Q12 28 22 28"
              } 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      )}
      
      <MessageBubbleTouchHandler
        onLongPress={handleLongPress}
        onDoubleTap={handleDoubleTap}
        isOwnMessage={isOwnMessage}
        isMenuOpen={showContextMenu}
      >
        <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'} ${message.message_type !== 'text' ? 'media' : ''} ${isEditing ? 'editing' : ''}`}>
          {renderContent()}
          
          {reactionEntries.length > 0 && (
            <div className="bubble-reactions">
              {reactionEntries.map(([emoji, userIds]) => (
                <span 
                  key={emoji} 
                  className={`bubble-reaction ${userIds.includes(currentUser?.id || '') ? 'own' : ''}`}
                  onClick={() => handleReactionSelect(emoji)}
                >
                  {emoji}
                  {userIds.length > 1 && <span className="reaction-count">{userIds.length}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <span className="message-time">{formattedTime}</span>
      </MessageBubbleTouchHandler>

      {showContextMenu && (
        <MediaContextMenu
          reactions={message.reactions || {}}
          userId={currentUser?.id || ''}
          onReactionSelect={handleReactionSelect}
          onReply={handleReply}
          onEdit={isOwnMessage && message.message_type === 'text' ? handleEdit : undefined}
          onCopy={message.message_type === 'text' && message.content.text ? handleCopy : undefined}
          onSave={message.media_url ? async () => {
            try {
              const response = await fetch(message.media_url!)
              const blob = await response.blob()
              const file = new File([blob], `pinkblue-${Date.now()}.${blob.type.split('/')[1]}`, { type: blob.type })
              if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file] })
              }
            } catch (e) {
              console.error('Save failed:', e)
            }
            setShowContextMenu(false)
          } : undefined}
          onDelete={() => {
            onDelete(message.id)
            setShowContextMenu(false)
          }}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </div>
  )
}

interface TouchHandlerProps {
  children: React.ReactNode
  onLongPress: () => void
  onDoubleTap: () => void
  isOwnMessage: boolean
  isMenuOpen: boolean
}

function MessageBubbleTouchHandler({ 
  children, 
  onLongPress, 
  onDoubleTap,
  isOwnMessage,
  isMenuOpen,
}: TouchHandlerProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<number>(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    isLongPressRef.current = false

    longPressTimer.current = setTimeout(() => {
      isLongPressRef.current = true
      triggerHaptic()
      onLongPress()
    }, 500)
  }, [onLongPress, triggerHaptic])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartRef.current.x)
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)
    if (dx > 10 || dy > 10) {
      clearTimers()
    }
  }, [clearTimers])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimers()
    if (isLongPressRef.current) {
      e.preventDefault()
      return
    }

    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      e.preventDefault()
      onDoubleTap()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [clearTimers, onDoubleTap])

  return (
    <div 
      className={`message-bubble-touch-area ${isOwnMessage ? 'own' : 'other'} ${isMenuOpen ? 'zoomed' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  )
}
