import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useChatStore } from '../stores/chatStore'

const TYPING_TIMEOUT = 3000

interface PresenceState {
  userId: string
  displayName: string
  isTyping: boolean
  timestamp: number
}

export function useChatTyping() {
  const { currentUser, setOtherUserTyping } = useChatStore()
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!currentUser || !channelRef.current) return
    
    channelRef.current.track({
      userId: currentUser.id,
      displayName: currentUser.displayName,
      isTyping,
      timestamp: Date.now(),
    })
  }, [currentUser])

  const handleTyping = useCallback(() => {
    sendTypingStatus(true)
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false)
    }, TYPING_TIMEOUT)
  }, [sendTypingStatus])

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    sendTypingStatus(false)
  }, [sendTypingStatus])

  useEffect(() => {
    if (!currentUser) return

    const channel = supabase.channel('chat_typing', {
      config: { presence: { key: currentUser.id } }
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        
        const otherUsers = Object.entries(state)
          .filter(([key]) => key !== currentUser.id)
          .flatMap(([, presences]) => (presences as unknown as PresenceState[]))
        
        const typingUser = otherUsers.find(u => u.isTyping)
        
        if (typingUser) {
          setOtherUserTyping({
            isTyping: true,
            userId: typingUser.userId,
          })
        } else {
          setOtherUserTyping(null)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            displayName: currentUser.displayName,
            isTyping: false,
            timestamp: Date.now(),
          })
        }
      })

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [currentUser, setOtherUserTyping])

  return {
    handleTyping,
    stopTyping,
  }
}
