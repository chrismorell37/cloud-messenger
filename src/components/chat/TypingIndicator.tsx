import { useChatStore } from '../../stores/chatStore'

const USER1_NAME = import.meta.env.VITE_USER1_NAME || 'User 1'
const USER2_NAME = import.meta.env.VITE_USER2_NAME || 'User 2'

export function TypingIndicator() {
  const { otherUserTyping } = useChatStore()

  if (!otherUserTyping?.isTyping) return null

  const typingUserName = otherUserTyping.userId === 'user1' ? USER1_NAME : USER2_NAME

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-bubble">
        <div className="typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
      <span className="typing-indicator-text">{typingUserName} is typing...</span>
    </div>
  )
}
