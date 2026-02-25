import { useChatStore } from '../../stores/chatStore'
import { useChatMessages } from '../../hooks/useChatMessages'
import { useChatTyping } from '../../hooks/useChatTyping'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ChatPhotoLightbox } from './ChatPhotoLightbox'

interface ChatViewProps {
  onSignOut: () => void
}

const USER1_NAME = import.meta.env.VITE_USER1_NAME || 'User 1'
const USER2_NAME = import.meta.env.VITE_USER2_NAME || 'User 2'

export function ChatView({ onSignOut }: ChatViewProps) {
  const { currentUser, otherUserTyping } = useChatStore()
  
  useChatMessages()
  useChatTyping()

  const otherUserName = currentUser?.id === 'user1' ? USER2_NAME : USER1_NAME

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
