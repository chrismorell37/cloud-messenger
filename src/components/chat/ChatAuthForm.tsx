import { useState } from 'react'
import type { ChatUser } from '../../stores/chatStore'

const USER1_PASSWORD = import.meta.env.VITE_USER1_PASSWORD
const USER2_PASSWORD = import.meta.env.VITE_USER2_PASSWORD
const USER1_NAME = import.meta.env.VITE_USER1_NAME || 'User 1'
const USER2_NAME = import.meta.env.VITE_USER2_NAME || 'User 2'

interface ChatAuthFormProps {
  onSuccess: (user: ChatUser) => void
}

export default function ChatAuthForm({ onSuccess }: ChatAuthFormProps) {
  const [selectedUser, setSelectedUser] = useState<'user1' | 'user2' | null>(null)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUserSelect = (userId: 'user1' | 'user2') => {
    setSelectedUser(userId)
    setPassword('')
    setError(null)
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPassword('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    
    setIsLoading(true)
    setError(null)

    await new Promise(resolve => setTimeout(resolve, 500))

    const expectedPassword = selectedUser === 'user1' ? USER1_PASSWORD : USER2_PASSWORD
    const displayName = selectedUser === 'user1' ? USER1_NAME : USER2_NAME

    if (password === expectedPassword) {
      const user: ChatUser = {
        id: selectedUser,
        displayName
      }
      sessionStorage.setItem('chat-messenger-user', JSON.stringify(user))
      onSuccess(user)
    } else {
      setError('Incorrect password')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="w-full max-w-sm">
        <div className="bg-dark-surface rounded-xl p-8 shadow-2xl border border-dark-border">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-dark-text">
              Pink/Blue
            </h1>
            <p className="text-sm text-dark-muted mt-2">
              {selectedUser ? 'Enter your password' : 'Who are you?'}
            </p>
          </div>

          {!selectedUser ? (
            <div className="space-y-3">
              <button
                onClick={() => handleUserSelect('user1')}
                className="w-full py-4 px-4 bg-blue-500 hover:bg-blue-600 
                         text-white font-medium rounded-lg
                         transition-colors flex items-center justify-center gap-3"
              >
                <span className="text-2xl">💙</span>
                <span>{USER1_NAME}</span>
              </button>
              
              <button
                onClick={() => handleUserSelect('user2')}
                className="w-full py-4 px-4 bg-pink-500 hover:bg-pink-600 
                         text-white font-medium rounded-lg
                         transition-colors flex items-center justify-center gap-3"
              >
                <span className="text-2xl">💗</span>
                <span>{USER2_NAME}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg mb-4">
                <span className="text-2xl">
                  {selectedUser === 'user1' ? '💙' : '💗'}
                </span>
                <span className="text-dark-text font-medium">
                  {selectedUser === 'user1' ? USER1_NAME : USER2_NAME}
                </span>
                <button
                  type="button"
                  onClick={handleBack}
                  className="ml-auto text-sm text-dark-muted hover:text-dark-text"
                >
                  Change
                </button>
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg 
                           text-dark-text placeholder-dark-muted
                           focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent
                           transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-dark-accent hover:bg-dark-accent-hover 
                         text-white font-medium rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-offset-2 focus:ring-offset-dark-surface
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Checking...
                  </span>
                ) : (
                  'Enter'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
