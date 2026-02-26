import { useEffect, useRef, useCallback, useState } from 'react'

const PRESET_EMOJIS = ['🩵', '🥹', '🤣', '🩷', '❤️‍🔥', '🫣']

const EXTENDED_EMOJIS = [
  '😍', '😘', '🥰', '😊', '😂', '😭',
  '🔥', '💀', '👀', '🙌', '👏', '🎉',
  '💯', '✨', '💕', '💗', '💖', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🖤',
  '🤔', '😮', '😱', '🤯', '😤', '😡',
  '👍', '👎', '🙏', '💪', '🤝', '✌️',
]

interface MediaContextMenuProps {
  reactions: Record<string, string[]>
  userId: string
  onReactionSelect: (emoji: string) => void
  onReply: () => void
  onEdit?: () => void
  onCopy?: () => void
  onSave?: () => void
  onDelete: () => void
  onClose: () => void
}

export function MediaContextMenu({
  reactions,
  userId,
  onReactionSelect,
  onReply,
  onEdit,
  onCopy,
  onSave,
  onDelete,
  onClose,
}: MediaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef<number>(Date.now())
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
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

  return (
    <>
      {/* Backdrop - only close on explicit tap, not on touch end */}
      <div 
        className="context-menu-backdrop" 
        onClick={handleClose}
        onTouchStart={handleClose}
      />
      
      {/* Menu - centered on screen */}
      <div
        ref={menuRef}
        className="context-menu"
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
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`emoji-button emoji-button-add ${showEmojiPicker ? 'emoji-button-active' : ''}`}
          >
            +
          </button>
        </div>
        
        {showEmojiPicker && (
          <div className="emoji-picker-grid">
            {EXTENDED_EMOJIS.map((emoji) => {
              const hasReacted = reactions[emoji]?.includes(userId)
              return (
                <button
                  key={emoji}
                  onClick={() => onReactionSelect(emoji)}
                  className={`emoji-grid-button ${hasReacted ? 'emoji-button-active' : ''}`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        )}

        {/* Divider */}
        <div className="context-menu-divider" />

        {/* Action buttons */}
        <button onClick={onReply} className="context-menu-action">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
          </svg>
          <span>Reply</span>
        </button>

        {onEdit && (
          <button onClick={onEdit} className="context-menu-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
            <span>Edit</span>
          </button>
        )}

        {onCopy && (
          <button onClick={onCopy} className="context-menu-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span>Copy</span>
          </button>
        )}

        {onSave && (
          <button onClick={onSave} className="context-menu-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span>Save</span>
          </button>
        )}

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
