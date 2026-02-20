import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  saveDraft,
  deleteDraft,
  getAllDrafts,
  updateDraftRetryCount,
  generateDraftId,
  type VoiceNoteDraft,
} from '../lib/draftStorage'

const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 4000, 8000]

async function uploadToStorage(file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `uploads/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    return null
  }

  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(filePath)

  return publicUrl
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useDraftUpload() {
  const [pendingDrafts, setPendingDrafts] = useState<VoiceNoteDraft[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const refreshDrafts = useCallback(async () => {
    const drafts = await getAllDrafts()
    setPendingDrafts(drafts)
  }, [])

  useEffect(() => {
    refreshDrafts()
  }, [refreshDrafts])

  const uploadWithRetry = useCallback(
    async (
      blob: Blob,
      duration: number,
      mimeType: string
    ): Promise<{ success: boolean; url?: string; draftId?: string }> => {
      const draftId = generateDraftId()
      const extension = mimeType.includes('webm') ? 'webm' : 'm4a'
      
      const draft: VoiceNoteDraft = {
        id: draftId,
        blob,
        duration,
        createdAt: Date.now(),
        retryCount: 0,
        mimeType,
      }

      await saveDraft(draft)
      await refreshDrafts()

      const file = new File([blob], `voice-note-${draftId}.${extension}`, { type: mimeType })

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        setIsUploading(true)
        
        try {
          const url = await uploadToStorage(file)
          
          if (url) {
            await deleteDraft(draftId)
            await refreshDrafts()
            setIsUploading(false)
            return { success: true, url }
          }
        } catch (error) {
          console.error(`Upload attempt ${attempt + 1} failed:`, error)
        }

        await updateDraftRetryCount(draftId)
        
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt])
        }
      }

      setIsUploading(false)
      await refreshDrafts()
      return { success: false, draftId }
    },
    [refreshDrafts]
  )

  const retryDraft = useCallback(
    async (draftId: string): Promise<{ success: boolean; url?: string }> => {
      const drafts = await getAllDrafts()
      const draft = drafts.find((d) => d.id === draftId)
      
      if (!draft) {
        return { success: false }
      }

      setIsUploading(true)
      const extension = draft.mimeType.includes('webm') ? 'webm' : 'm4a'
      const file = new File(
        [draft.blob],
        `voice-note-${draftId}.${extension}`,
        { type: draft.mimeType }
      )

      try {
        const url = await uploadToStorage(file)
        
        if (url) {
          await deleteDraft(draftId)
          await refreshDrafts()
          setIsUploading(false)
          return { success: true, url }
        }
      } catch (error) {
        console.error('Retry upload failed:', error)
      }

      await updateDraftRetryCount(draftId)
      await refreshDrafts()
      setIsUploading(false)
      return { success: false }
    },
    [refreshDrafts]
  )

  const removeDraft = useCallback(
    async (draftId: string) => {
      await deleteDraft(draftId)
      await refreshDrafts()
    },
    [refreshDrafts]
  )

  return {
    pendingDrafts,
    isUploading,
    uploadWithRetry,
    retryDraft,
    removeDraft,
    refreshDrafts,
  }
}
