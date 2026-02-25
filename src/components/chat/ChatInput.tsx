import { useState, useRef, useCallback } from 'react'
import { useChatMessages } from '../../hooks/useChatMessages'
import { useChatTyping } from '../../hooks/useChatTyping'
import { supabase } from '../../lib/supabase'

export function ChatInput() {
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const { sendMessage } = useChatMessages()
  const { handleTyping, stopTyping } = useChatTyping()
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

    return publicUrl
  }, [])

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    stopTyping()
    setText('')

    await sendMessage(
      { type: 'text', text: trimmedText },
      'text'
    )
  }, [text, sendMessage, stopTyping])

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
          await sendMessage(
            { type: 'audio', attrs: {} },
            'audio',
            url
          )
        }
        setIsUploading(false)
        
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)
      setIsRecording(true)
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

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
              if (isRecording) {
                stopRecording()
              } else {
                startRecording()
              }
              setShowMediaMenu(false)
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              {isRecording ? 'Stop Recording' : 'Voice Note'}
            </button>
          </div>
        )}

        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          rows={1}
          className="chat-input-textarea"
          disabled={isUploading}
        />

        {isRecording ? (
          <button
            onClick={stopRecording}
            className="chat-input-send-btn recording"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
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
