import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useChatStore, type ChatMessage } from '../stores/chatStore'

export function useChatMessages() {
  const { 
    messages, 
    setMessages, 
    addMessage, 
    updateMessage,
    currentUser 
  } = useChatStore()
  
  const isSubscribedRef = useRef(false)

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages' as 'messages')
      .select('*')
      .eq('is_deleted' as 'id', false as unknown as string)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error loading messages:', error)
      return
    }
    
    setMessages(data as unknown as ChatMessage[])
  }, [setMessages])

  const sendMessage = useCallback(async (
    content: { type: string; text?: string; attrs?: Record<string, unknown> },
    messageType: ChatMessage['message_type'] = 'text',
    mediaUrl?: string,
    replyTo?: string
  ) => {
    if (!currentUser) return null

    const newMessage = {
      sender_id: currentUser.id,
      content,
      message_type: messageType,
      media_url: mediaUrl || null,
      reactions: {},
      reply_to: replyTo || null,
      is_deleted: false,
    }

    const { data, error } = await supabase
      .from('chat_messages' as 'messages')
      .insert(newMessage as never)
      .select()
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return null
    }

    const sentMessage = data as unknown as ChatMessage
    addMessage(sentMessage)
    return sentMessage
  }, [currentUser, addMessage])

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUser) return

    const message = messages.find(m => m.id === messageId)
    if (!message) return

    const reactions = { ...message.reactions }
    if (!reactions[emoji]) {
      reactions[emoji] = []
    }

    if (reactions[emoji].includes(currentUser.id)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== currentUser.id)
      if (reactions[emoji].length === 0) {
        delete reactions[emoji]
      }
    } else {
      reactions[emoji] = [...reactions[emoji], currentUser.id]
    }

    const { error } = await supabase
      .from('chat_messages' as 'messages')
      .update({ reactions } as never)
      .eq('id', messageId)

    if (error) {
      console.error('Error updating reaction:', error)
      return
    }

    updateMessage(messageId, { reactions })
  }, [currentUser, messages, updateMessage])

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from('chat_messages' as 'messages')
      .update({ is_deleted: true } as never)
      .eq('id', messageId)

    if (error) {
      console.error('Error deleting message:', error)
      return
    }

    updateMessage(messageId, { is_deleted: true })
  }, [updateMessage])

  const editMessage = useCallback(async (messageId: string, newText: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message) return

    const updatedContent = { ...message.content, text: newText }

    const { error } = await supabase
      .from('chat_messages' as 'messages')
      .update({ content: updatedContent } as never)
      .eq('id', messageId)

    if (error) {
      console.error('Error editing message:', error)
      return
    }

    updateMessage(messageId, { content: updatedContent } as Partial<ChatMessage>)
  }, [messages, updateMessage])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (isSubscribedRef.current) return
    isSubscribedRef.current = true

    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          if (newMessage.sender_id !== currentUser?.id) {
            addMessage(newMessage)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updated = payload.new as ChatMessage
          updateMessage(updated.id, updated)
        }
      )
      .subscribe()

    return () => {
      isSubscribedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, addMessage, updateMessage])

  return {
    messages,
    sendMessage,
    addReaction,
    deleteMessage,
    editMessage,
    loadMessages,
  }
}
