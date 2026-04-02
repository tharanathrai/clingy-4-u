import { createClient } from '@supabase/supabase-js'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          username: string
          avatar_url: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          username?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          id: string
          user_a_id: string
          user_b_id: string
          status: 'pending' | 'active'
          requested_by: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          user_a_id: string
          user_b_id: string
          status: 'pending' | 'active'
          requested_by: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          user_a_id?: string
          user_b_id?: string
          status?: 'pending' | 'active'
          requested_by?: string
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      gum_pieces: {
        Row: {
          id: string
          creator_id: string
          recipient_id: string
          title: string
          category: string
          color_hex: string
          status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at: string
          accepted_at: string | null
          expires_at: string
          confirmed_at: string | null
        }
        Insert: {
          id?: string
          creator_id: string
          recipient_id: string
          title: string
          category: string
          color_hex: string
          status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at?: string
          accepted_at?: string | null
          expires_at: string
          confirmed_at?: string | null
        }
        Update: {
          id?: string
          creator_id?: string
          recipient_id?: string
          title?: string
          category?: string
          color_hex?: string
          status?: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at?: string
          accepted_at?: string | null
          expires_at?: string
          confirmed_at?: string | null
        }
        Relationships: []
      }
      bridges: {
        Row: {
          id: string
          gum_piece_id: string
          user_a_id: string
          user_b_id: string
          category: string
          color_hex: string
          activity_title: string
          formed_at: string
        }
        Insert: {
          id?: string
          gum_piece_id: string
          user_a_id: string
          user_b_id: string
          category: string
          color_hex: string
          activity_title: string
          formed_at?: string
        }
        Update: {
          id?: string
          gum_piece_id?: string
          user_a_id?: string
          user_b_id?: string
          category?: string
          color_hex?: string
          activity_title?: string
          formed_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type:
            | 'invite_received'
            | 'invite_accepted'
            | 'invite_rejected'
            | 'plan_turned_down'
            | 'plan_expiring_soon'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
          reference_id: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type:
            | 'invite_received'
            | 'invite_accepted'
            | 'invite_rejected'
            | 'plan_turned_down'
            | 'plan_expiring_soon'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
          reference_id: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?:
            | 'invite_received'
            | 'invite_accepted'
            | 'invite_rejected'
            | 'plan_turned_down'
            | 'plan_expiring_soon'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
          reference_id?: string
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          slug: string
          label: string
          color_hex: string
          keywords: string[]
        }
        Insert: {
          slug: string
          label: string
          color_hex: string
          keywords: string[]
        }
        Update: {
          slug?: string
          label?: string
          color_hex?: string
          keywords?: string[]
        }
        Relationships: []
      }
      rotating_qr_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          expires_at: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          expires_at?: string
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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
