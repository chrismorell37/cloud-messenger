import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresencePayload {
  id: string
  email: string
  cursor: { x: number; y: number } | null
  isRecording?: boolean
}

export function usePresence() {
  const { user, setOtherUserPresence } = useEditorStore()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const isRecordingRef = useRef<boolean>(false)

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    cursorRef.current = { x, y }
    
    if (channelRef.current && user) {
      channelRef.current.track({
        id: user.id,
        email: user.email,
        cursor: { x, y },
        isRecording: isRecordingRef.current,
      })
    }
  }, [user])

  // Clear cursor when mouse leaves
  const clearCursor = useCallback(() => {
    cursorRef.current = null
    
    if (channelRef.current && user) {
      channelRef.current.track({
        id: user.id,
        email: user.email,
        cursor: null,
        isRecording: isRecordingRef.current,
      })
    }
  }, [user])

  // Set recording status
  const setRecordingStatus = useCallback((isRecording: boolean) => {
    isRecordingRef.current = isRecording
    
    if (channelRef.current && user) {
      channelRef.current.track({
        id: user.id,
        email: user.email,
        cursor: cursorRef.current,
        isRecording,
      })
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('presence:editor', {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>()
        
        // Find the other user's presence
        for (const [key, presences] of Object.entries(state)) {
          if (key !== user.id && presences.length > 0) {
            const otherUser = presences[0]
            setOtherUserPresence({
              id: otherUser.id,
              email: otherUser.email,
              cursor: otherUser.cursor,
              isRecording: otherUser.isRecording,
            })
            return
          }
        }
        
        // No other user present
        setOtherUserPresence(null)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== user.id && newPresences.length > 0) {
          const otherUser = newPresences[0] as unknown as PresencePayload
          setOtherUserPresence({
            id: otherUser.id,
            email: otherUser.email,
            cursor: otherUser.cursor,
            isRecording: otherUser.isRecording,
          })
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== user.id) {
          setOtherUserPresence(null)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            email: user.email,
            cursor: cursorRef.current,
            isRecording: isRecordingRef.current,
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [user, setOtherUserPresence])

  return {
    updateCursor,
    clearCursor,
    setRecordingStatus,
  }
}
