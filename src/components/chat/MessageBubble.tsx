import { useMemo, useCallback, useState } from 'react'
import { useChatStore, type ChatMessage } from '../../stores/chatStore'
import { MediaContextMenu } from '../MediaContextMenu'

interface MessageBubbleProps {
  message: ChatMessage
  onAddReaction: (messageId: string, emoji: string) => void
  onDelete: (messageId: string) => void
  showTimestamp?: boolean
}

const USER1_NAME = import.meta.env.VITE_USER1_NAME || 'User 1'
const USER2_NAME = import.meta.env.VITE_USER2_NAME || 'User 2'

export function MessageBubble({ 
  message, 
  onAddReaction, 
  onDelete,
  showTimestamp = false 
}: MessageBubbleProps) {
  const { currentUser, setLightboxImage } = useChatStore()
  const [showContextMenu, setShowContextMenu] = useState(false)
  
  const isOwnMessage = message.sender_id === currentUser?.id
  const senderName = message.sender_id === 'user1' ? USER1_NAME : USER2_NAME

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
    } else {
      onAddReaction(message.id, '🩵')
    }
  }, [message, onAddReaction, setLightboxImage])

  const renderContent = () => {
    switch (message.message_type) {
      case 'text':
        return (
          <p className="bubble-text">
            {message.content.text || ''}
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
          <div className="bubble-gallery">
            {images.map((src, idx) => (
              <img 
                key={idx}
                src={src} 
                alt={`Gallery image ${idx + 1}`}
                className="bubble-gallery-image"
                onClick={() => setLightboxImage(src)}
              />
            ))}
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
      
      <MessageBubbleTouchHandler
        onLongPress={handleLongPress}
        onDoubleTap={handleDoubleTap}
        isOwnMessage={isOwnMessage}
      >
        <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'} ${message.message_type !== 'text' ? 'media' : ''}`}>
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
          onReply={() => setShowContextMenu(false)}
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
}

function MessageBubbleTouchHandler({ 
  children, 
  onLongPress, 
  onDoubleTap,
  isOwnMessage,
}: TouchHandlerProps) {
  const [isPressing, setIsPressing] = useState(false)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = React.useRef<number>(0)
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = React.useRef(false)

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setIsPressing(false)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    isLongPressRef.current = false

    longPressTimer.current = setTimeout(() => {
      isLongPressRef.current = true
      setIsPressing(true)
      onLongPress()
      setTimeout(() => setIsPressing(false), 150)
    }, 800)
  }, [onLongPress])

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
      className={`message-bubble-touch-area ${isOwnMessage ? 'own' : 'other'} ${isPressing ? 'pressing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  )
}

import React from 'react'
