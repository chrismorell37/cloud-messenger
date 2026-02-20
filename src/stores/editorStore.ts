import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import type { User } from '../types'

interface EditorState {
  // Document state
  documentId: string | null
  content: JSONContent | null
  lastSavedAt: Date | null
  isSaving: boolean
  hasUnsavedChanges: boolean
  
  // User state
  user: User | null
  isAuthenticated: boolean
  
  // Other user's presence
  otherUserPresence: {
    id: string
    email: string
    cursor: { x: number; y: number } | null
    isRecording?: boolean
  } | null
  
  // Actions
  setDocumentId: (id: string) => void
  setContent: (content: JSONContent) => void
  setLastSavedAt: (date: Date) => void
  setIsSaving: (isSaving: boolean) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  setUser: (user: User | null) => void
  setIsAuthenticated: (isAuthenticated: boolean) => void
  setOtherUserPresence: (presence: EditorState['otherUserPresence']) => void
  reset: () => void
}

const initialState = {
  documentId: null,
  content: null,
  lastSavedAt: null,
  isSaving: false,
  hasUnsavedChanges: false,
  user: null,
  isAuthenticated: false,
  otherUserPresence: null,
}

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,
  
  setDocumentId: (id) => set({ documentId: id }),
  setContent: (content) => set({ content }),
  setLastSavedAt: (date) => set({ lastSavedAt: date }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
  setUser: (user) => set({ user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setOtherUserPresence: (presence) => set({ otherUserPresence: presence }),
  reset: () => set(initialState),
}))
