import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresencePayload {
  id: string
  email: string
  cursor: { x: number; y: number } | null
}

export function usePresence() {
  const { user, setOtherUserPresence } = useEditorStore()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    cursorRef.current = { x, y }
    
    if (channelRef.current && user) {
      channelRef.current.track({
        id: user.id,
        email: user.email,
        cursor: { x, y },
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
  }
}
