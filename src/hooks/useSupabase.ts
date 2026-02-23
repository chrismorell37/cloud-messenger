import { useEffect, useCallback, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

const DOCUMENT_ID = '00000000-0000-0000-0000-000000000001'

interface MessagePayload {
  id: string
  content: JSONContent
  html_content: string | null
  user_id: string | null
  updated_at: string
  created_at: string
}

export function useSupabaseRealtime(
  onContentChange: (content: JSONContent) => void
) {
  const { user } = useEditorStore()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isLocalUpdateRef = useRef(false)

  // Mark local updates to prevent feedback loops
  const markLocalUpdate = useCallback(() => {
    isLocalUpdateRef.current = true
    // Reset after a short delay
    setTimeout(() => {
      isLocalUpdateRef.current = false
    }, 500)
  }, [])

  // Load initial content
  const loadContent = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', DOCUMENT_ID)
      .single()

    if (error) {
      console.error('Error loading content:', error)
      return null
    }

    const typedData = data as unknown as MessagePayload | null
    return typedData?.content || null
  }, [])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('messages:realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `id=eq.${DOCUMENT_ID}`,
        },
        (payload) => {
          // Skip if this was our own update
          if (isLocalUpdateRef.current) return
          
          const newRecord = payload.new as MessagePayload
          const newContent = newRecord?.content
          const updatedBy = newRecord?.user_id
          
          // Only update if change came from the other user
          if (newContent && updatedBy !== user.id) {
            onContentChange(newContent)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [user, onContentChange])

  return {
    loadContent,
    markLocalUpdate,
    documentId: DOCUMENT_ID,
  }
}

// Hook for media upload to Supabase Storage
export function useMediaUpload() {
  const uploadMedia = useCallback(async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `uploads/${fileName}`

    console.log('Uploading file:', file.name, 'to path:', filePath)

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      alert(`Upload failed: ${uploadError.message}\n\nMake sure to create the 'media' storage bucket in Supabase.`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath)

    console.log('Upload successful, public URL:', publicUrl)
    return publicUrl
  }, [])

  return { uploadMedia }
}
