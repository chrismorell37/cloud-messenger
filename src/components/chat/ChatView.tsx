import { useCallback, useState } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useChatMessages } from '../../hooks/useChatMessages'
import { useChatTyping } from '../../hooks/useChatTyping'
import { useSpotify } from '../../hooks/useSpotify'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ChatPhotoLightbox } from './ChatPhotoLightbox'

interface ChatViewProps {
  onSignOut: () => void
}

export function ChatView({ onSignOut }: ChatViewProps) {
  const { currentUser, otherUserTyping } = useChatStore()
  const appUserId = currentUser ? `chat_${currentUser.id}` : 'editor'
  const {
    connected: spotifyConnected,
    needPlaylist: spotifyNeedPlaylist,
    connectUrl: spotifyConnectUrl,
    listPlaylists,
    savePlaylist,
    playlistsLoading,
  } = useSpotify(appUserId)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const [playlistList, setPlaylistList] = useState<Array<{ id: string; name: string; uri: string }>>([])
  
  const { clearAllMessages } = useChatMessages()
  useChatTyping()

  // If current user is S (user1), other user is C. If current user is C (user2), other user is S.
  const otherUserName = currentUser?.id === 'user1' ? 'C' : 'S'

  const handleClearHistory = useCallback(async () => {
    if (confirm('Delete all chat history? This cannot be undone.')) {
      await clearAllMessages()
    }
  }, [clearAllMessages])

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
          
          <div className="chat-header-actions">
            {!spotifyConnected ? (
              <a href={spotifyConnectUrl} className="chat-header-btn text-green-500 hover:text-green-400">
                Connect Spotify
              </a>
            ) : spotifyNeedPlaylist ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={async () => {
                    setShowPlaylistPicker(true)
                    const list = await listPlaylists()
                    setPlaylistList(list)
                  }}
                  disabled={playlistsLoading}
                  className="chat-header-btn text-green-500 hover:text-green-400 disabled:opacity-50"
                >
                  {playlistsLoading ? 'Loading…' : 'Choose playlist'}
                </button>
                {showPlaylistPicker && playlistList.length > 0 && (
                  <>
                    <div className="absolute top-full right-0 mt-1 py-2 min-w-[200px] max-h-60 overflow-y-auto rounded-lg border border-dark-border bg-dark-surface shadow-lg z-50">
                      {playlistList.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={async () => {
                            await savePlaylist(p.id)
                            setShowPlaylistPicker(false)
                            setPlaylistList([])
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-dark-border/50"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="Close"
                      onClick={() => {
                        setShowPlaylistPicker(false)
                        setPlaylistList([])
                      }}
                    />
                  </>
                )}
              </div>
            ) : null}
            <button
              onClick={handleClearHistory}
              className="chat-header-btn"
            >
              Clear
            </button>
            <button
              onClick={onSignOut}
              className="chat-header-btn"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <MessageList />
      <ChatInput />
      <ChatPhotoLightbox />
    </div>
  )
}
