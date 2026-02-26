import { useChatStore } from '../../stores/chatStore'
import { useChatMessages } from '../../hooks/useChatMessages'
import { useChatTyping } from '../../hooks/useChatTyping'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ChatPhotoLightbox } from './ChatPhotoLightbox'

interface ChatViewProps {
  onSignOut: () => void
}

export function ChatView({ onSignOut }: ChatViewProps) {
  const { currentUser, otherUserTyping } = useChatStore()
  
  useChatMessages()
  useChatTyping()

  // If current user is S (user1), other user is C. If current user is C (user2), other user is S.
  const otherUserName = currentUser?.id === 'user1' ? 'C' : 'S'

  return (
    <div className="chat-view">
      <header className="chat-header">
        <div className="chat-header-content">
          <div className="chat-header-info">
            <h1 className="chat-header-title">Pink/Blue</h1>
            {otherUserTyping?.isTyping ? (
              <span className="chat-header-status">{otherUserName} is typing...</span>
            ) : (
              <span className="chat-header-status">with {otherUserName}</span>
            )}
          </div>
          
          <button
            onClick={onSignOut}
            className="chat-header-lock"
          >
            Lock
          </button>
        </div>
      </header>

      <MessageList />
      <ChatInput />
      <ChatPhotoLightbox />
    </div>
  )
}
