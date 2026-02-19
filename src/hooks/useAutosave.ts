import { useCallback, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'

const DOCUMENT_ID = '00000000-0000-0000-0000-000000000001'
const AUTOSAVE_DELAY = 2000 // 2 seconds

export function useAutosave() {
  const { 
    setIsSaving, 
    setLastSavedAt, 
    setHasUnsavedChanges,
  } = useEditorStore()
  
  const lastContentRef = useRef<string>('')

  const saveContent = useCallback(async (content: JSONContent, htmlContent: string) => {
    const contentString = JSON.stringify(content)
    
    // Skip if content hasn't actually changed
    if (contentString === lastContentRef.current) {
      return
    }
    
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: content as unknown as Record<string, unknown>,
          html_content: htmlContent,
        })
        .eq('id', DOCUMENT_ID)

      if (error) {
        console.error('Error saving content:', error)
        setIsSaving(false)
        return false
      }

      lastContentRef.current = contentString
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      setIsSaving(false)
      
      // Fire-and-forget notification (don't block on response)
      fetch('/api/notify', { method: 'POST' }).catch(() => {})
      
      return true
    } catch (err) {
      console.error('Error saving content:', err)
      setIsSaving(false)
      return false
    }
  }, [setIsSaving, setLastSavedAt, setHasUnsavedChanges])

  const debouncedSave = useDebouncedCallback(
    (content: JSONContent, htmlContent: string) => {
      saveContent(content, htmlContent)
    },
    AUTOSAVE_DELAY
  )

  const triggerSave = useCallback((content: JSONContent, htmlContent: string) => {
    setHasUnsavedChanges(true)
    debouncedSave(content, htmlContent)
  }, [debouncedSave, setHasUnsavedChanges])

  // Force immediate save (e.g., before navigating away)
  const forceSave = useCallback(async (content: JSONContent, htmlContent: string) => {
    debouncedSave.cancel()
    await saveContent(content, htmlContent)
  }, [debouncedSave, saveContent])

  return {
    triggerSave,
    forceSave,
    documentId: DOCUMENT_ID,
  }
}
