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
          status: 'pending' | 'active' | 'removed'
          requested_by: string
          created_at: string
          accepted_at: string | null
          snoozed_by_a: boolean
          snoozed_by_b: boolean
        }
        Insert: {
          id?: string
          user_a_id: string
          user_b_id: string
          status: 'pending' | 'active' | 'removed'
          requested_by: string
          created_at?: string
          accepted_at?: string | null
          snoozed_by_a?: boolean
          snoozed_by_b?: boolean
        }
        Update: {
          id?: string
          user_a_id?: string
          user_b_id?: string
          status?: 'pending' | 'active' | 'removed'
          requested_by?: string
          created_at?: string
          accepted_at?: string | null
          snoozed_by_a?: boolean
          snoozed_by_b?: boolean
        }
        Relationships: []
      }
      gum_pieces: {
        Row: {
          id: string
          creator_id: string
          recipient_id: string | null
          title: string
          category: string
          color_hex: string
          status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at: string
          accepted_at: string | null
          expires_at: string
          confirmed_at: string | null
          planned_date: string | null
        }
        Insert: {
          id?: string
          creator_id: string
          recipient_id?: string | null
          title: string
          category: string
          color_hex: string
          status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at?: string
          accepted_at?: string | null
          expires_at: string
          confirmed_at?: string | null
          planned_date?: string | null
        }
        Update: {
          id?: string
          creator_id?: string
          recipient_id?: string | null
          title?: string
          category?: string
          color_hex?: string
          status?: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
          created_at?: string
          accepted_at?: string | null
          expires_at?: string
          confirmed_at?: string | null
          planned_date?: string | null
        }
        Relationships: []
      }
      gum_piece_members: {
        Row: {
          id: string
          gum_piece_id: string
          user_id: string
          role: 'creator' | 'invitee'
          status: 'pending' | 'accepted' | 'declined'
          invited_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          gum_piece_id: string
          user_id: string
          role: 'creator' | 'invitee'
          status?: 'pending' | 'accepted' | 'declined'
          invited_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          gum_piece_id?: string
          user_id?: string
          role?: 'creator' | 'invitee'
          status?: 'pending' | 'accepted' | 'declined'
          invited_at?: string
          responded_at?: string | null
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
      posts: {
        Row: {
          id: string
          bridge_id: string
          author_id: string
          body: string
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          bridge_id: string
          author_id: string
          body: string
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          bridge_id?: string
          author_id?: string
          body?: string
          is_public?: boolean
          created_at?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      confirmation_sessions: {
        Row: {
          id: string
          gum_piece_id: string
          otp_code: string
          initiator_id: string
          confirmed_member_ids: string[]
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          gum_piece_id: string
          otp_code: string
          initiator_id: string
          confirmed_member_ids?: string[]
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          gum_piece_id?: string
          otp_code?: string
          initiator_id?: string
          confirmed_member_ids?: string[]
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      graveyard: {
        Row: {
          id: string
          gum_piece_id: string
          user_a_id: string
          user_b_id: string
          member_ids: string[]
          title: string
          category: string
          color_hex: string
          created_at: string
          expired_at: string
        }
        Insert: {
          id?: string
          gum_piece_id: string
          user_a_id: string
          user_b_id: string
          member_ids?: string[]
          title: string
          category: string
          color_hex: string
          created_at: string
          expired_at?: string
        }
        Update: {
          id?: string
          gum_piece_id?: string
          user_a_id?: string
          user_b_id?: string
          member_ids?: string[]
          title?: string
          category?: string
          color_hex?: string
          created_at?: string
          expired_at?: string
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
            | 'member_declined'
            | 'plan_expiring_soon'
            | 'plan_expired'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
            | 'connection_accepted'
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
            | 'member_declined'
            | 'plan_expiring_soon'
            | 'plan_expired'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
            | 'connection_accepted'
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
            | 'member_declined'
            | 'plan_expiring_soon'
            | 'plan_expired'
            | 'bridge_formed'
            | 'post_comment'
            | 'post_reaction'
            | 'connection_request'
            | 'connection_accepted'
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
    Functions: {
      snooze_friend: {
        Args: { other_user_id: string }
        Returns: void
      }
      unsnooze_friend: {
        Args: { other_user_id: string }
        Returns: void
      }
      remove_friend: {
        Args: { other_user_id: string }
        Returns: void
      }
    }
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
