import { useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useChatMessages } from '../../hooks/useChatMessages'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

export function MessageList() {
  const { messages } = useChatStore()
  const { addReaction, deleteMessage, editMessage } = useChatMessages()
  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  const handleScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
  }, [])

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom('instant')
    }
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    scrollToBottom('instant')
  }, [scrollToBottom])

  const shouldShowTimestamp = (index: number): boolean => {
    if (index === 0) return true
    const currentDate = new Date(messages[index].created_at).toDateString()
    const prevDate = new Date(messages[index - 1].created_at).toDateString()
    return currentDate !== prevDate
  }

  const visibleMessages = messages.filter(m => !m.is_deleted)

  return (
    <div 
      ref={listRef}
      className="message-list"
      onScroll={handleScroll}
    >
      <div className="message-list-content">
        {visibleMessages.length === 0 ? (
          <div className="message-list-empty">
            <p className="text-dark-muted text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          visibleMessages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              onAddReaction={addReaction}
              onDelete={deleteMessage}
              onEdit={editMessage}
              showTimestamp={shouldShowTimestamp(index)}
              allMessages={messages}
            />
          ))
        )}
        
        <TypingIndicator />
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  )
}
