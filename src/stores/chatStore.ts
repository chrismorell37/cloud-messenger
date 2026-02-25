import { create } from 'zustand'

export interface ChatMessage {
  id: string
  sender_id: 'user1' | 'user2'
  content: {
    type: string
    text?: string
    attrs?: Record<string, unknown>
  }
  message_type: 'text' | 'image' | 'video' | 'audio' | 'spotify' | 'instagram' | 'gallery'
  media_url?: string | null
  reactions: Record<string, string[]>
  reply_to?: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface ChatUser {
  id: 'user1' | 'user2'
  displayName: string
}

interface OtherUserTyping {
  isTyping: boolean
  userId: string
}

interface ChatState {
  messages: ChatMessage[]
  currentUser: ChatUser | null
  isAuthenticated: boolean
  isLoading: boolean
  otherUserTyping: OtherUserTyping | null
  lightboxImage: string | null
  
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (id: string) => void
  setCurrentUser: (user: ChatUser | null) => void
  setIsAuthenticated: (isAuthenticated: boolean) => void
  setIsLoading: (isLoading: boolean) => void
  setOtherUserTyping: (typing: OtherUserTyping | null) => void
  setLightboxImage: (url: string | null) => void
  reset: () => void
}

const initialState = {
  messages: [],
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  otherUserTyping: null,
  lightboxImage: null,
}

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  
  deleteMessage: (id) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, is_deleted: true } : msg
    )
  })),
  
  setCurrentUser: (user) => set({ currentUser: user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setOtherUserTyping: (typing) => set({ otherUserTyping: typing }),
  setLightboxImage: (url) => set({ lightboxImage: url }),
  reset: () => set(initialState),
}))
