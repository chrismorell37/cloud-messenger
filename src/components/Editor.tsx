import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/react'
import { CustomImage, Video, Audio, SpotifyEmbed } from '../lib/extensions'
import { compressVideoIfNeeded, isVideoFile, getFileSizeMB, MAX_SIZE_MB } from '../lib/videoCompression'
import { searchSongs, getSpotifyUrl, extractSpotifyUrl, buildSpotifySearchUrl, type SongResult } from '../lib/musicSearch'
import { useDebouncedCallback } from 'use-debounce'
import { useAutosave } from '../hooks/useAutosave'
import { useSupabaseRealtime, useMediaUpload } from '../hooks/useSupabase'
import { usePresence } from '../hooks/usePresence'
import { useDraftUpload } from '../hooks/useDraftUpload'
import { useEditorStore } from '../stores/editorStore'
import PresenceCursors from './PresenceCursors'

export default function Editor() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [songSearchQuery, setSongSearchQuery] = useState('')
  const [songSearchResults, setSongSearchResults] = useState<SongResult[]>([])
  const [isSearchingSongs, setIsSearchingSongs] = useState(false)
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [toolbarBottom, setToolbarBottom] = useState(0)
  const [showDraftsMenu, setShowDraftsMenu] = useState(false)
  const { isSaving, hasUnsavedChanges, lastSavedAt, otherUserPresence } = useEditorStore()
  const { triggerSave, forceSave } = useAutosave()
  const { uploadMedia } = useMediaUpload()
  const { updateCursor, clearCursor, setRecordingStatus } = usePresence()
  const { pendingDrafts, isUploading, uploadWithRetry, retryDraft, removeDraft } = useDraftUpload()
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRemoteUpdate = useRef(false)

  // Handle content updates from other user
  const handleRemoteContentChange = useCallback((content: JSONContent) => {
    if (editor && !isRemoteUpdate.current) {
      isRemoteUpdate.current = true
      const { from, to } = editor.state.selection
      editor.commands.setContent(content)
      // Try to restore cursor position
      try {
        editor.commands.setTextSelection({ from, to })
      } catch {
        // Position may be invalid after content change
      }
      setTimeout(() => {
        isRemoteUpdate.current = false
      }, 100)
    }
  }, [])

  const { loadContent, markLocalUpdate } = useSupabaseRealtime(handleRemoteContentChange)

  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomImage,
      Link.configure({
        autolink: true,
        openOnClick: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-dark-accent hover:text-dark-accent-hover underline',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
      Video,
      Audio,
      SpotifyEmbed,
      Placeholder.configure({
        placeholder: 'Start typing your message...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          handleFileDrop(event.dataTransfer.files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos || 0)
          return true
        }
        return false
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files
        if (files?.length) {
          handleFileDrop(files)
          return true
        }
        // Check for Spotify URL in pasted text
        const text = event.clipboardData?.getData('text/plain')
        if (text) {
          const spotifyUrl = extractSpotifyUrl(text)
          if (spotifyUrl) {
            handleSpotifyUrlPaste(spotifyUrl)
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (!isRemoteUpdate.current) {
        markLocalUpdate()
        triggerSave(editor.getJSON(), editor.getHTML())
      }
    },
  })

  // Handle file drop/paste for images, videos, and audio
  const handleFileDrop = useCallback(async (files: FileList, pos?: number) => {
    if (!editor) return

    for (let file of Array.from(files)) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isAudio = file.type.startsWith('audio/')

      if (!isImage && !isVideo && !isAudio) continue

      // Compress video if needed (over 75MB)
      if (isVideo && isVideoFile(file) && getFileSizeMB(file) > MAX_SIZE_MB) {
        setIsCompressing(true)
        setCompressionProgress(0)
        try {
          file = await compressVideoIfNeeded(file, (progress) => {
            setCompressionProgress(progress)
          })
        } catch (err) {
          console.error('Compression error:', err)
        } finally {
          setIsCompressing(false)
          setCompressionProgress(0)
        }
      }

      // Show loading state with placeholder
      let placeholder = '[Uploading...]'
      if (isImage) placeholder = '![Uploading...]()'
      else if (isVideo) placeholder = '[Uploading video...]'
      else if (isAudio) placeholder = '[Uploading audio...]'

      // Insert placeholder
      if (pos !== undefined) {
        editor.chain().focus().insertContentAt(pos, placeholder).run()
      }

      // Upload to Supabase Storage
      const url = await uploadMedia(file)

      if (url) {
        // Remove placeholder and insert actual media
        if (isImage) {
          editor.chain().focus().setImage({ src: url }).run()
        } else if (isVideo) {
          editor.chain().focus().setVideo({ src: url }).run()
        } else if (isAudio) {
          editor.chain().focus().setAudio({ src: url }).run()
        }
      }
    }
  }, [editor, uploadMedia])

  // Handle Spotify URL paste - auto-embed
  const handleSpotifyUrlPaste = useCallback((spotifyUrl: string) => {
    if (!editor) return
    editor.chain().focus().setSpotifyEmbed({ spotifyUri: spotifyUrl }).run()
  }, [editor])

  // Handle song search (debounced)
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

  // Handle song selection - get Spotify URL and embed
  const handleSongSelect = useCallback(async (song: SongResult) => {
    if (!editor) return
    setIsLoadingSpotify(true)
    try {
      const result = await getSpotifyUrl(song.trackViewUrl)
      if (result.spotifyUrl) {
        editor.chain().focus().setSpotifyEmbed({ spotifyUri: result.spotifyUrl }).run()
        setShowSongSearch(false)
        setSongSearchQuery('')
        setSongSearchResults([])
      } else {
        // Fallback: Open Spotify search and let user paste the link
        const searchUrl = buildSpotifySearchUrl(song.trackName, song.artistName)
        const confirmed = confirm(
          `Couldn't auto-link this song. Would you like to open Spotify to find it?\n\n` +
          `After finding the song on Spotify, tap Share → Copy Link, then paste it in your note.`
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
  }, [editor])

  // Handle file selection from file input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) {
      handleFileDrop(files)
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [handleFileDrop])

  // Load initial content
  useEffect(() => {
    const init = async () => {
      const content = await loadContent()
      if (content && editor) {
        editor.commands.setContent(content)
      }
      setIsLoading(false)
    }

    if (editor) {
      init()
    }
  }, [editor, loadContent])

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && editor) {
        e.preventDefault()
        await forceSave(editor.getJSON(), editor.getHTML())
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, editor, forceSave])

  // Handle cursor tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (editorContainerRef.current) {
      const rect = editorContainerRef.current.getBoundingClientRect()
      updateCursor(e.clientX - rect.left, e.clientY - rect.top)
    }
  }, [updateCursor])

  // Manual save handler
  const handleManualSave = useCallback(() => {
    if (editor && hasUnsavedChanges && !isSaving) {
      forceSave(editor.getJSON(), editor.getHTML())
    }
  }, [editor, hasUnsavedChanges, isSaving, forceSave])

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Use audio/webm for better compatibility, fallback to audio/mp4 for Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Store the start time for duration calculation
      const startTime = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        
        // Calculate final duration
        const finalDuration = Math.floor((Date.now() - startTime) / 1000)
        setRecordingDuration(0)

        // Broadcast that we stopped recording
        setRecordingStatus(false)

        // Create audio blob and upload with retry
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        
        const result = await uploadWithRetry(audioBlob, finalDuration, mimeType)
        
        if (result.success && result.url && editor) {
          editor.chain().focus().setAudio({ src: result.url }).run()
        } else if (!result.success) {
          // Upload failed after retries - draft was saved
          alert('Voice note saved as draft. Check pending uploads to retry.')
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      
      // Broadcast that we're recording
      setRecordingStatus(true)
      
      // Start duration timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setRecordingDuration(elapsed)
      }, 100) // Update more frequently for smoother display
      
    } catch (err) {
      console.error('Error starting recording:', err)
      setRecordingStatus(false)
      alert('Could not access microphone. Please allow microphone access.')
    }
  }, [editor, uploadWithRetry, setRecordingStatus])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
    setRecordingStatus(false)
  }, [setRecordingStatus])

  // Handle retry of a draft voice note
  const handleRetryDraft = useCallback(async (draftId: string) => {
    const result = await retryDraft(draftId)
    if (result.success && result.url && editor) {
      editor.chain().focus().setAudio({ src: result.url }).run()
      setShowDraftsMenu(false)
    } else if (!result.success) {
      alert('Upload failed. Please try again when you have a better connection.')
    }
  }, [editor, retryDraft])

  // Cleanup recording on unmount only
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  // Detect keyboard visibility and position using Visual Viewport API (for iOS)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const updatePosition = () => {
      // Position toolbar at the bottom of the visual viewport
      // This works by calculating the TOP position based on viewport
      const toolbarHeight = 44 // h-11 = 44px
      const top = viewport.offsetTop + viewport.height - toolbarHeight
      setToolbarBottom(top)
    }

    viewport.addEventListener('resize', updatePosition)
    viewport.addEventListener('scroll', updatePosition)
    updatePosition()

    return () => {
      viewport.removeEventListener('resize', updatePosition)
      viewport.removeEventListener('scroll', updatePosition)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-dark-muted">
          <div className="w-5 h-5 border-2 border-dark-muted border-t-dark-accent rounded-full animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Status bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-dark-surface/80 backdrop-blur-sm border-b border-dark-border">
        <div className="flex items-center gap-4">
          {otherUserPresence && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-dark-muted">
                {otherUserPresence.isRecording 
                  ? `${otherUserPresence.email.split('@')[0]} is recording...`
                  : `${otherUserPresence.email.split('@')[0]} is here`
                }
              </span>
              {otherUserPresence.isRecording && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-xs font-medium">Recording</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-dark-muted">
          {/* Undo/Redo buttons */}
          <button
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-dark-border 
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 14-4-4 4-4"/>
              <path d="M5 10h11a4 4 0 0 1 0 8h-1"/>
            </svg>
          </button>
          <button
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-dark-border 
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Redo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 14 4-4-4-4"/>
              <path d="M19 10H8a4 4 0 0 0 0 8h1"/>
            </svg>
          </button>

          <div className="w-px h-5 bg-dark-border mx-1" />

          {isSaving && (
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 border border-dark-muted border-t-dark-accent rounded-full animate-spin" />
              Saving...
            </span>
          )}
          {!isSaving && hasUnsavedChanges && (
            <button
              onClick={handleManualSave}
              className="flex items-center gap-2 px-3 py-1 bg-dark-accent/20 hover:bg-dark-accent/30 
                       text-dark-accent rounded-md transition-colors"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </button>
          )}
          {!isSaving && !hasUnsavedChanges && lastSavedAt && (
            <span className="text-green-600">Saved {formatTimeAgo(lastSavedAt)}</span>
          )}
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={editorContainerRef}
        className="relative min-h-[calc(100vh-8rem)]"
        onMouseMove={handleMouseMove}
        onMouseLeave={clearCursor}
      >
        {/* Other user's cursor */}
        {otherUserPresence?.cursor && (
          <PresenceCursors 
            cursor={otherUserPresence.cursor} 
            email={otherUserPresence.email} 
          />
        )}

        <EditorContent 
          editor={editor} 
          className="prose prose-invert max-w-none"
        />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={filesInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraVideoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Compression progress overlay */}
      {isCompressing && (
        <div className="fixed inset-0 z-50 bg-dark-bg/90 flex items-center justify-center">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-3 border-dark-border border-t-dark-accent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-dark-text mb-1">
                  Compressing Video
                </h3>
                <p className="text-sm text-dark-muted">
                  Optimizing for faster upload...
                </p>
              </div>
              <div className="w-full bg-dark-border rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-dark-accent transition-all duration-300 ease-out"
                  style={{ width: `${compressionProgress}%` }}
                />
              </div>
              <p className="text-sm text-dark-muted">
                {compressionProgress}% complete
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Song search modal */}
      {showSongSearch && (
        <div className="fixed inset-0 z-50 bg-dark-bg/90 flex items-start justify-center pt-20 px-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 12a4 4 0 0 0 8 0"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Add Song
              </h3>
              <button
                onClick={() => {
                  setShowSongSearch(false)
                  setSongSearchQuery('')
                  setSongSearchResults([])
                }}
                className="p-1 hover:bg-dark-border rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-muted">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            {/* Search input */}
            <div className="p-4">
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  type="text"
                  value={songSearchQuery}
                  onChange={(e) => handleSongSearch(e.target.value)}
                  placeholder="Search for a song..."
                  className="w-full pl-10 pr-4 py-3 bg-dark-bg border border-dark-border rounded-lg 
                           text-dark-text placeholder:text-dark-muted focus:outline-none 
                           focus:border-dark-accent transition-colors"
                  autoFocus
                />
                {isSearchingSongs && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-dark-muted border-t-dark-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {songSearchResults.length === 0 && songSearchQuery && !isSearchingSongs && (
                <div className="p-4 text-center text-dark-muted">
                  No songs found. Try a different search.
                </div>
              )}
              {songSearchResults.map((song) => (
                <button
                  key={song.trackId}
                  onClick={() => handleSongSelect(song)}
                  disabled={isLoadingSpotify}
                  className="w-full p-3 flex items-center gap-3 hover:bg-dark-border/50 
                           transition-colors text-left disabled:opacity-50 disabled:cursor-wait"
                >
                  <img
                    src={song.artworkUrl100}
                    alt={song.collectionName}
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-dark-text font-medium truncate">{song.trackName}</p>
                    <p className="text-sm text-dark-muted truncate">{song.artistName}</p>
                    <p className="text-xs text-dark-muted/70 truncate">{song.collectionName}</p>
                  </div>
                  {isLoadingSpotify && (
                    <div className="w-5 h-5 border-2 border-dark-muted border-t-green-500 rounded-full animate-spin" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-dark-border">
              <p className="text-xs text-dark-muted text-center">
                You can also paste a Spotify link directly in the note
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Menu backdrops */}
      {(showMediaMenu || showDraftsMenu) && (
        <div 
          className="fixed inset-0 z-20"
          onClick={() => {
            setShowMediaMenu(false)
            setShowDraftsMenu(false)
          }}
        />
      )}

      {/* Floating buttons */}
      <div 
        className="fixed right-6 flex flex-col gap-3 z-30"
        style={{ top: toolbarBottom - 140, bottom: 'auto' }}
      >
        {/* Voice recording button with drafts */}
        <div className="relative">
          <button
            onClick={isRecording ? stopRecording : () => setShowDraftsMenu(!showDraftsMenu)}
            onDoubleClick={() => !isRecording && startRecording()}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg 
                       transition-all duration-200 hover:scale-105 active:scale-95
                       ${isRecording 
                         ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                         : 'bg-dark-surface hover:bg-dark-border border border-dark-border'}`}
            aria-label={isRecording ? 'Stop recording' : 'Voice notes menu'}
          >
            {isRecording ? (
              <div className="flex flex-col items-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  className="text-white"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span className="text-[10px] text-white font-medium mt-0.5">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-dark-text"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>
          
          {/* Pending drafts badge */}
          {pendingDrafts.length > 0 && !isRecording && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{pendingDrafts.length}</span>
            </div>
          )}
          
          {/* Drafts menu */}
          {showDraftsMenu && !isRecording && (
            <div className="absolute bottom-16 right-0 bg-dark-surface border border-dark-border rounded-xl shadow-xl overflow-hidden min-w-[220px]">
              {/* Record new button */}
              <button
                onClick={() => {
                  setShowDraftsMenu(false)
                  startRecording()
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                </div>
                <span className="text-dark-text font-medium">Record New</span>
              </button>
              
              {/* Pending drafts */}
              {pendingDrafts.length > 0 && (
                <>
                  <div className="border-t border-dark-border" />
                  <div className="px-4 py-2 bg-orange-500/10">
                    <span className="text-xs text-orange-600 font-medium">
                      Pending Uploads ({pendingDrafts.length})
                    </span>
                  </div>
                  {pendingDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="px-4 py-3 flex items-center gap-3 border-t border-dark-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-dark-text truncate">
                          Voice note ({formatDuration(draft.duration)})
                        </p>
                        <p className="text-xs text-dark-muted">
                          {new Date(draft.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRetryDraft(draft.id)}
                          disabled={isUploading}
                          className="p-2 hover:bg-dark-border rounded-lg transition-colors disabled:opacity-50"
                          aria-label="Retry upload"
                        >
                          {isUploading ? (
                            <div className="w-4 h-4 border-2 border-dark-muted border-t-dark-accent rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-accent">
                              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                              <path d="M3 3v5h5"/>
                              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                              <path d="M16 16h5v5"/>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => removeDraft(draft.id)}
                          className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                          aria-label="Delete draft"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Media menu */}
        {showMediaMenu && (
          <div className="absolute bottom-16 right-0 bg-dark-surface border border-dark-border rounded-xl shadow-xl overflow-hidden min-w-[180px]">
            <button
              onClick={() => {
                cameraPhotoInputRef.current?.click()
                setShowMediaMenu(false)
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-muted">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              <span className="text-dark-text">Take Photo</span>
            </button>
            <button
              onClick={() => {
                cameraVideoInputRef.current?.click()
                setShowMediaMenu(false)
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-muted">
                <path d="m22 8-6 4 6 4V8Z"/>
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
              </svg>
              <span className="text-dark-text">Take Video</span>
            </button>
            <div className="border-t border-dark-border" />
            <button
              onClick={() => {
                fileInputRef.current?.click()
                setShowMediaMenu(false)
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-muted">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span className="text-dark-text">Photo Library</span>
            </button>
            <button
              onClick={() => {
                filesInputRef.current?.click()
                setShowMediaMenu(false)
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-muted">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              </svg>
              <span className="text-dark-text">Files</span>
            </button>
            <div className="border-t border-dark-border" />
            <button
              onClick={() => {
                setShowSongSearch(true)
                setShowMediaMenu(false)
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-border/50 transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12a4 4 0 0 0 8 0"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <span className="text-dark-text">Add Song</span>
            </button>
          </div>
        )}

        {/* Add media button */}
        <button
          onClick={() => setShowMediaMenu(!showMediaMenu)}
          disabled={isRecording}
          className={`w-14 h-14 bg-dark-accent hover:bg-dark-accent-hover 
                     rounded-full flex items-center justify-center shadow-lg 
                     transition-all duration-200 hover:scale-105 active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed
                     ${showMediaMenu ? 'rotate-45' : ''}`}
          aria-label="Add photo, video, or audio"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="text-white transition-transform duration-200"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Text formatting toolbar */}
      <div 
        className="fixed left-0 right-0 h-11 bg-dark-surface border-t border-dark-border flex items-center justify-center gap-1 px-4 z-20"
        style={{ top: toolbarBottom, bottom: 'auto' }}
      >
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`w-10 h-9 rounded-md flex items-center justify-center transition-colors
                     ${editor?.isActive('bold') ? 'bg-dark-accent text-white' : 'text-dark-text hover:bg-dark-border'}`}
          aria-label="Bold"
        >
          <span className="font-bold text-base">B</span>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`w-10 h-9 rounded-md flex items-center justify-center transition-colors
                     ${editor?.isActive('italic') ? 'bg-dark-accent text-white' : 'text-dark-text hover:bg-dark-border'}`}
          aria-label="Italic"
        >
          <span className="italic text-base">I</span>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={`w-10 h-9 rounded-md flex items-center justify-center transition-colors
                     ${editor?.isActive('underline') ? 'bg-dark-accent text-white' : 'text-dark-text hover:bg-dark-border'}`}
          aria-label="Underline"
        >
          <span className="underline text-base">U</span>
        </button>
        <button
          onClick={() => {
            if (editor?.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              setLinkUrl('')
              setShowLinkModal(true)
            }
          }}
          className={`w-10 h-9 rounded-md flex items-center justify-center transition-colors
                     ${editor?.isActive('link') ? 'bg-dark-accent text-white' : 'text-dark-text hover:bg-dark-border'}`}
          aria-label="Link"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>

      {/* Link input modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-4 border-b border-dark-border">
              <h3 className="text-lg font-semibold text-dark-text">Add Link</h3>
            </div>
            <div className="p-4">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg 
                         text-dark-text placeholder:text-dark-muted focus:outline-none 
                         focus:border-dark-accent transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && linkUrl) {
                    e.preventDefault()
                    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
                    editor?.chain().focus().setLink({ href: url }).run()
                    setShowLinkModal(false)
                    setLinkUrl('')
                  } else if (e.key === 'Escape') {
                    setShowLinkModal(false)
                    setLinkUrl('')
                  }
                }}
              />
            </div>
            <div className="p-4 border-t border-dark-border flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkUrl('')
                }}
                className="px-4 py-2 text-dark-muted hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (linkUrl) {
                    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
                    editor?.chain().focus().setLink({ href: url }).run()
                    setShowLinkModal(false)
                    setLinkUrl('')
                  }
                }}
                disabled={!linkUrl}
                className="px-4 py-2 bg-dark-accent hover:bg-dark-accent-hover text-white rounded-lg 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  
  return date.toLocaleDateString()
}

// Helper function to format recording duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
