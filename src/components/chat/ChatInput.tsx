import { useState, useRef, useCallback, useEffect } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useChatMessages } from '../../hooks/useChatMessages'
import { useChatTyping } from '../../hooks/useChatTyping'
import { useChatStore } from '../../stores/chatStore'
import { supabase } from '../../lib/supabase'
import { toCdnUrl } from '../../lib/cdn'
import { searchSongs, getSpotifyUrl, extractSpotifyUrl, buildSpotifySearchUrl, type SongResult } from '../../lib/musicSearch'
import { extractInstagramUrl } from '../../lib/instagramExtension'

export function ChatInput() {
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [songSearchQuery, setSongSearchQuery] = useState('')
  const [songSearchResults, setSongSearchResults] = useState<SongResult[]>([])
  const [isSearchingSongs, setIsSearchingSongs] = useState(false)
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false)
  
  const { sendMessage } = useChatMessages()
  const { handleTyping, stopTyping } = useChatTyping()
  const { replyingTo, setReplyingTo } = useChatStore()
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const voiceNoteInputRef = useRef<HTMLInputElement>(null)
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Recording timer effect
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      setRecordingDuration(0)
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [isRecording])

  // Format seconds as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const uploadMedia = useCallback(async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `uploads/${fileName}`

    const { error } = await supabase.storage
      .from('media')
      .upload(filePath, file, { contentType: file.type })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath)

    return toCdnUrl(publicUrl)
  }, [])

  // Spotify song search (debounced)
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) {
      setSongSearchResults([])
      setIsSearchingSongs(false)
      return
    }
    setIsSearchingSongs(true)
    try {
      const results = await searchSongs(query)
      setSongSearchResults(results)
    } catch (err) {
      console.error('Song search error:', err)
    } finally {
      setIsSearchingSongs(false)
    }
  }, 300)

  const handleSongSearch = useCallback((query: string) => {
    setSongSearchQuery(query)
    if (!query.trim()) {
      setSongSearchResults([])
      setIsSearchingSongs(false)
      return
    }
    setIsSearchingSongs(true)
    debouncedSearch(query)
  }, [debouncedSearch])

  const handleSongSelect = useCallback(async (song: SongResult) => {
    setIsLoadingSpotify(true)
    try {
      const result = await getSpotifyUrl(song.trackViewUrl)
      if (result.spotifyUrl) {
        await sendMessage(
          { type: 'spotify', attrs: { spotifyUri: result.spotifyUrl } },
          'spotify'
        )
        setShowSongSearch(false)
        setSongSearchQuery('')
        setSongSearchResults([])
      } else {
        const searchUrl = buildSpotifySearchUrl(song.trackName, song.artistName)
        const confirmed = confirm(
          `Couldn't auto-link this song. Would you like to open Spotify to find it?\n\n` +
          `After finding the song on Spotify, tap Share → Copy Link, then paste it here.`
        )
        if (confirmed) {
          window.open(searchUrl, '_blank')
        }
      }
    } catch (err) {
      console.error('Error getting Spotify URL:', err)
      alert('Failed to get Spotify link. Please try again.')
    } finally {
      setIsLoadingSpotify(false)
    }
  }, [sendMessage])

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    const replyToId = replyingTo?.id

    // Check for Spotify URL
    const spotifyUrl = extractSpotifyUrl(trimmedText)
    if (spotifyUrl) {
      stopTyping()
      setText('')
      setReplyingTo(null)
      await sendMessage(
        { type: 'spotify', attrs: { spotifyUri: spotifyUrl } },
        'spotify',
        undefined,
        replyToId
      )
      return
    }

    // Check for Instagram URL
    const instagramUrl = extractInstagramUrl(trimmedText)
    if (instagramUrl) {
      stopTyping()
      setText('')
      setReplyingTo(null)
      await sendMessage(
        { type: 'instagram', attrs: { instagramUrl } },
        'instagram',
        undefined,
        replyToId
      )
      return
    }

    // Regular text message
    stopTyping()
    setText('')
    setReplyingTo(null)
    await sendMessage(
      { type: 'text', text: trimmedText },
      'text',
      undefined,
      replyToId
    )
  }, [text, sendMessage, stopTyping, replyingTo, setReplyingTo])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    handleTyping()
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [handleTyping])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setShowMediaMenu(false)

    for (const file of Array.from(files)) {
      const url = await uploadMedia(file)
      if (!url) continue

      let messageType: 'image' | 'video' | 'audio' = 'image'
      if (file.type.startsWith('video/')) messageType = 'video'
      else if (file.type.startsWith('audio/')) messageType = 'audio'

      await sendMessage(
        { type: messageType, attrs: {} },
        messageType,
        url
      )
    }

    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [uploadMedia, sendMessage])

  // Handle album selection - multiple images become a gallery
  const handleAlbumSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) {
      if (albumInputRef.current) albumInputRef.current.value = ''
      return
    }

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      if (albumInputRef.current) albumInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    setShowMediaMenu(false)

    // If only one image, send as regular image
    if (imageFiles.length === 1) {
      const url = await uploadMedia(imageFiles[0])
      if (url) {
        await sendMessage({ type: 'image', attrs: {} }, 'image', url)
      }
    } else {
      // Upload all images and create gallery
      const uploadedUrls: string[] = []
      for (const file of imageFiles) {
        const url = await uploadMedia(file)
        if (url) uploadedUrls.push(url)
      }

      if (uploadedUrls.length > 1) {
        await sendMessage(
          { type: 'gallery', attrs: { images: uploadedUrls } },
          'gallery'
        )
      } else if (uploadedUrls.length === 1) {
        await sendMessage({ type: 'image', attrs: {} }, 'image', uploadedUrls[0])
      }
    }

    setIsUploading(false)
    if (albumInputRef.current) albumInputRef.current.value = ''
  }, [uploadMedia, sendMessage])

  // Handle voice note file upload
  const handleVoiceNoteUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setShowMediaMenu(false)

    for (const file of Array.from(files)) {
      const url = await uploadMedia(file)
      if (url) {
        await sendMessage({ type: 'audio', attrs: {} }, 'audio', url)
      }
    }

    setIsUploading(false)
    if (voiceNoteInputRef.current) voiceNoteInputRef.current.value = ''
  }, [uploadMedia, sendMessage])

  // Handle camera photo capture
  const handleCameraPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setShowMediaMenu(false)

    const url = await uploadMedia(files[0])
    if (url) {
      await sendMessage({ type: 'image', attrs: {} }, 'image', url)
    }

    setIsUploading(false)
    if (cameraPhotoInputRef.current) cameraPhotoInputRef.current.value = ''
  }, [uploadMedia, sendMessage])

  // Handle camera video capture
  const handleCameraVideo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setShowMediaMenu(false)

    const url = await uploadMedia(files[0])
    if (url) {
      await sendMessage({ type: 'video', attrs: {} }, 'video', url)
    }

    setIsUploading(false)
    if (cameraVideoInputRef.current) cameraVideoInputRef.current.value = ''
  }, [uploadMedia, sendMessage])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
        const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        
        setIsUploading(true)
        const url = await uploadMedia(file)
        if (url) {
          await sendMessage({ type: 'audio', attrs: {} }, 'audio', url)
        }
        setIsUploading(false)
        
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)
      setIsRecording(true)
      setShowMediaMenu(false)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [uploadMedia, sendMessage])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  return (
    <div className="chat-input-container">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleAlbumSelect}
        className="hidden"
      />
      <input
        ref={voiceNoteInputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.aac"
        onChange={handleVoiceNoteUpload}
        className="hidden"
      />
      <input
        ref={cameraPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraPhoto}
        className="hidden"
      />
      <input
        ref={cameraVideoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleCameraVideo}
        className="hidden"
      />

      {/* Reply preview */}
      {replyingTo && (
        <div className="chat-reply-preview">
          <div className="chat-reply-preview-content">
            <span className="chat-reply-preview-label">
              Replying to {replyingTo.sender_id === 'user1' ? 'S' : 'C'}
            </span>
            <span className="chat-reply-preview-text">
              {replyingTo.message_type === 'text'
                ? (replyingTo.content.text || '').slice(0, 50) + ((replyingTo.content.text || '').length > 50 ? '...' : '')
                : replyingTo.message_type === 'image' ? 'Photo'
                : replyingTo.message_type === 'video' ? 'Video'
                : replyingTo.message_type === 'audio' ? 'Voice note'
                : replyingTo.message_type === 'spotify' ? 'Spotify'
                : replyingTo.message_type === 'gallery' ? 'Photo album'
                : 'Message'}
            </span>
          </div>
          <button 
            onClick={() => setReplyingTo(null)}
            className="chat-reply-preview-close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Song Search Modal */}
      {showSongSearch && (
        <div className="chat-song-search">
          <div className="chat-song-search-header">
            <input
              type="text"
              value={songSearchQuery}
              onChange={(e) => handleSongSearch(e.target.value)}
              placeholder="Search for a song..."
              autoFocus
              className="chat-song-search-input"
            />
            <button
              onClick={() => {
                setShowSongSearch(false)
                setSongSearchQuery('')
                setSongSearchResults([])
              }}
              className="chat-song-search-close"
            >
              Cancel
            </button>
          </div>
          
          <div className="chat-song-search-results">
            {isSearchingSongs && (
              <div className="chat-song-search-loading">Searching...</div>
            )}
            {isLoadingSpotify && (
              <div className="chat-song-search-loading">Getting Spotify link...</div>
            )}
            {!isSearchingSongs && !isLoadingSpotify && songSearchResults.map((song) => (
              <button
                key={song.trackId}
                onClick={() => handleSongSelect(song)}
                className="chat-song-result"
              >
                <img
                  src={song.artworkUrl100}
                  alt={song.trackName}
                  className="chat-song-artwork"
                />
                <div className="chat-song-info">
                  <div className="chat-song-title">{song.trackName}</div>
                  <div className="chat-song-artist">{song.artistName}</div>
                </div>
              </button>
            ))}
            {!isSearchingSongs && songSearchQuery && songSearchResults.length === 0 && (
              <div className="chat-song-search-empty">No results found</div>
            )}
          </div>
        </div>
      )}

      <div className="chat-input-wrapper">
        <button
          onClick={() => setShowMediaMenu(!showMediaMenu)}
          className="chat-input-media-btn"
          disabled={isUploading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        {showMediaMenu && (
          <div className="chat-media-menu">
            <button onClick={() => {
              fileInputRef.current?.click()
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Photo/Video
            </button>
            <button onClick={() => {
              albumInputRef.current?.click()
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <rect x="7" y="7" width="14" height="14" rx="2" ry="2"/>
              </svg>
              Photo Album
            </button>
            <button onClick={() => {
              cameraPhotoInputRef.current?.click()
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Take Photo
            </button>
            <button onClick={() => {
              cameraVideoInputRef.current?.click()
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              Record Video
            </button>
            <div className="chat-media-menu-divider" />
            <button onClick={() => {
              if (isRecording) {
                stopRecording()
              } else {
                startRecording()
              }
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              {isRecording ? 'Stop Recording' : 'Voice Note'}
            </button>
            <button onClick={() => {
              voiceNoteInputRef.current?.click()
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload Voice Note
            </button>
            <div className="chat-media-menu-divider" />
            <button onClick={() => {
              setShowSongSearch(true)
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <circle cx="17.5" cy="15.5" r="2.5"/>
                <path d="M8 17V5l12-2v12"/>
              </svg>
              Search Song
            </button>
          </div>
        )}

        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message (paste Spotify/Instagram links)"
          rows={1}
          className="chat-input-textarea"
          disabled={isUploading}
        />

        {isRecording ? (
          <>
            <div className="chat-recording-indicator">
              <span className="chat-recording-dot" />
              <span className="chat-recording-time">{formatDuration(recordingDuration)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="chat-input-send-btn recording"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() || isUploading}
            className="chat-input-send-btn"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
