import { useEffect, useState } from 'react'
import { useChatStore, type ChatUser } from './stores/chatStore'
import { ChatAuthForm, ChatView } from './components/chat'

function ChatApp() {
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated, setIsAuthenticated, setCurrentUser } = useChatStore()

  useEffect(() => {
    const savedUser = sessionStorage.getItem('chat-messenger-user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as ChatUser
        setCurrentUser(user)
        setIsAuthenticated(true)
      } catch (e) {
        sessionStorage.removeItem('chat-messenger-user')
      }
    }
    setIsLoading(false)
  }, [setIsAuthenticated, setCurrentUser])

  const handleSignOut = () => {
    sessionStorage.removeItem('chat-messenger-user')
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  const handleAuthSuccess = (user: ChatUser) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="flex items-center gap-3 text-dark-muted">
          <div className="w-6 h-6 border-2 border-dark-muted border-t-dark-accent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <ChatAuthForm onSuccess={handleAuthSuccess} />
  }

  return <ChatView onSignOut={handleSignOut} />
}

export default ChatApp
