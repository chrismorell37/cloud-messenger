import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef, useCallback, useState, useEffect } from 'react'
import { MediaWrapper, type Reply } from './MediaWrapper'
import { useEditorStore } from '../stores/editorStore'

export function AudioPlayer({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { src, played, transcription, reactions = {}, replies = [] } = node.attrs
  const { user } = useEditorStore()
  const userId = user?.id || 'anonymous'
  const userName = user?.email?.split('@')[0] || 'Anonymous'
  
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState(false)

  useEffect(() => {
    if (src && transcription === null && !isTranscribing && !transcriptionError) {
      setIsTranscribing(true)
      
      fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: src }),
      })
        .then(res => {
          if (!res.ok) throw new Error('Transcription failed')
          return res.json()
        })
        .then(data => {
          if (data.transcription) {
            updateAttributes({ transcription: data.transcription })
          }
        })
        .catch(err => {
          console.error('Transcription error:', err)
          setTranscriptionError(true)
        })
        .finally(() => {
          setIsTranscribing(false)
        })
    }
  }, [src, transcription, isTranscribing, transcriptionError, updateAttributes])

  const handlePlay = () => {
    if (!played) {
      updateAttributes({ played: true })
    }
  }

  const handleAddReaction = (emoji: string) => {
    const currentReactions = { ...reactions }
    if (!currentReactions[emoji]) {
      currentReactions[emoji] = []
    }
    if (!currentReactions[emoji].includes(userId)) {
      currentReactions[emoji] = [...currentReactions[emoji], userId]
      updateAttributes({ reactions: currentReactions })
    }
  }

  const handleRemoveReaction = (emoji: string) => {
    const currentReactions = { ...reactions }
    if (currentReactions[emoji]) {
      currentReactions[emoji] = currentReactions[emoji].filter((id: string) => id !== userId)
      if (currentReactions[emoji].length === 0) {
        delete currentReactions[emoji]
      }
      updateAttributes({ reactions: currentReactions })
    }
  }

  const handleReply = (text: string) => {
    const newReply: Reply = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text,
      userId,
      userName,
      timestamp: Date.now(),
    }
    updateAttributes({ replies: [...replies, newReply] })
  }

  const handleDelete = useCallback(() => {
    const pos = getPos()
    if (typeof pos === 'number' && editor) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    }
  }, [editor, getPos, node.nodeSize])

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  return (
    <NodeViewWrapper className="audio-player-wrapper">
      <MediaWrapper
        reactions={reactions}
        replies={replies}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onDelete={handleDelete}
        onReply={handleReply}
        userId={userId}
        mediaUrl={src}
      >
        <div className="relative">
          {!played && (
            <span className="audio-new-badge">
              New!
            </span>
          )}
          <audio
            ref={audioRef}
            src={src}
            controls
            preload="metadata"
            onPlay={handlePlay}
            className="w-full rounded-lg"
          />
        </div>
      </MediaWrapper>

      {/* Transcription section */}
      <div className="audio-transcription">
        {isTranscribing && (
          <div className="audio-transcription-loading">
            <div className="audio-transcription-spinner" />
            <span>Transcribing...</span>
          </div>
        )}
        
        {transcription && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="audio-transcription-toggle"
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
              className={`audio-transcription-arrow ${isExpanded ? 'expanded' : ''}`}
            >
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <span className="audio-transcription-preview">
              {isExpanded ? 'Hide transcription' : `"${truncateText(transcription)}"`}
            </span>
          </button>
        )}
        
        {transcription && isExpanded && (
          <div className="audio-transcription-text">
            {transcription}
          </div>
        )}
        
        {transcriptionError && !transcription && (
          <div className="audio-transcription-error">
            <span>Transcription unavailable</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
