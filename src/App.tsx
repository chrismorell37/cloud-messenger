import { useEffect, useState } from 'react'
import { useEditorStore } from './stores/editorStore'
import AuthForm from './components/AuthForm'
import Editor from './components/Editor'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const { isAuthenticated, setIsAuthenticated, setUser } = useEditorStore()

  // Check if already authenticated via sessionStorage (clears when browser/tab closes)
  useEffect(() => {
    const isAuthed = sessionStorage.getItem('cloud-messenger-auth') === 'true'
    if (isAuthed) {
      setIsAuthenticated(true)
      setUser({
        id: 'local-user',
        email: 'user@local',
      })
    }
    setIsLoading(false)
  }, [setIsAuthenticated, setUser])

  const handleSignOut = () => {
    sessionStorage.removeItem('cloud-messenger-auth')
    setUser(null)
    setIsAuthenticated(false)
  }

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
    setUser({
      id: 'local-user',
      email: 'user@local',
    })
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
    return <AuthForm onSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-dark-bg/90 backdrop-blur-sm border-b border-dark-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-dark-text">
            Pink/Blue
          </h1>
          
          <button
            onClick={handleSignOut}
            className="text-sm text-dark-muted hover:text-dark-text transition-colors"
          >
            Lock
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto">
        <Editor />
      </main>
    </div>
  )
}

export default App
