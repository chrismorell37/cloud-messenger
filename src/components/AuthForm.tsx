import { useState } from 'react'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD

interface AuthFormProps {
  onSuccess: () => void
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Small delay to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500))

    if (password === APP_PASSWORD) {
      localStorage.setItem('cloud-messenger-auth', 'true')
      onSuccess()
    } else {
      setError('Incorrect password')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="w-full max-w-sm">
        <div className="bg-dark-surface rounded-xl p-8 shadow-2xl border border-dark-border">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-dark-text mb-2">
              Pink + Blue
            </h1>
            <p className="text-dark-muted text-sm">
              Private space for two
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-muted mb-1">
                Password
              </label>
              <input
                id="password"
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
                placeholder="Enter password"
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
        </div>
      </div>
    </div>
  )
}
