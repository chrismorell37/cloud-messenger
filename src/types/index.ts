import type { JSONContent } from '@tiptap/react'

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          content: JSONContent
          html_content: string | null
          user_id: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          content?: JSONContent
          html_content?: string | null
          user_id?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          content?: JSONContent
          html_content?: string | null
          user_id?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          id: string
          message_id: string | null
          file_path: string
          file_type: 'image' | 'video'
          created_at: string
        }
        Insert: {
          id?: string
          message_id?: string | null
          file_path: string
          file_type: 'image' | 'video'
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string | null
          file_path?: string
          file_type?: 'image' | 'video'
          created_at?: string
        }
        Relationships: []
      }
      allowed_users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// User type
export interface User {
  id: string
  email: string
  displayName?: string
}

// Presence state for cursor tracking
export interface PresenceState {
  id: string
  email: string
  cursor: {
    x: number
    y: number
  } | null
  lastSeen: string
}

// Message type for the shared document
export type Message = Database['public']['Tables']['messages']['Row']

// Media attachment type
export type Media = Database['public']['Tables']['media']['Row']
