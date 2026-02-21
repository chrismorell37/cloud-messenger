import { useEffect, useRef, useCallback } from 'react'

const PRESET_EMOJIS = ['🩵', '🥹', '🤣', '🩷', '❤️‍🔥', '🫣']

interface MediaContextMenuProps {
  position: { x: number; y: number }
  reactions: Record<string, string[]>
  userId: string
  onReactionSelect: (emoji: string) => void
  onReply: () => void
  onDelete: () => void
  onClose: () => void
}

export function MediaContextMenu({
  position,
  reactions,
  userId,
  onReactionSelect,
  onReply,
  onDelete,
  onClose,
}: MediaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef<number>(Date.now())
  
  const handleClose = useCallback(() => {
    // Ignore close events within 400ms of opening (to handle long press release)
    if (Date.now() - openedAtRef.current < 400) {
      return
    }
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, handleClose])

  // Adjust position to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 280),
    y: Math.min(position.y, window.innerHeight - 200),
  }

  return (
    <>
      {/* Backdrop - only close on explicit tap, not on touch end */}
      <div 
        className="context-menu-backdrop" 
        onClick={handleClose}
        onTouchStart={handleClose}
      />
      
      {/* Menu */}
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {/* Emoji reactions row */}
        <div className="context-menu-emojis">
          {PRESET_EMOJIS.map((emoji) => {
            const hasReacted = reactions[emoji]?.includes(userId)
            return (
              <button
                key={emoji}
                onClick={() => onReactionSelect(emoji)}
                className={`emoji-button ${hasReacted ? 'emoji-button-active' : ''}`}
              >
                {emoji}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="context-menu-divider" />

        {/* Action buttons */}
        <button onClick={onReply} className="context-menu-action">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
          </svg>
          <span>Reply</span>
        </button>

        <button onClick={onDelete} className="context-menu-action context-menu-action-danger">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </>
  )
}
