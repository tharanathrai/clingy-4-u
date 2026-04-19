export type ConnectionStatus = 'pending' | 'active'

export type GumPieceStatus =
  | 'placeholder'
  | 'active'
  | 'confirmed'
  | 'expired'
  | 'turned_down'

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_rejected'
  | 'plan_turned_down'
  | 'plan_expiring_soon'
  | 'plan_expired'
  | 'bridge_formed'
  | 'post_comment'
  | 'post_reaction'
  | 'connection_request'

export interface User {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export interface Connection {
  id: string
  user_a_id: string
  user_b_id: string
  status: ConnectionStatus
  requested_by: string
  created_at: string
  accepted_at: string | null
}

export interface GumPiece {
  id: string
  creator_id: string
  recipient_id: string
  title: string
  category: string
  color_hex: string
  status: GumPieceStatus
  created_at: string
  accepted_at: string | null
  expires_at: string
  confirmed_at: string | null
}

export interface Bridge {
  id: string
  gum_piece_id: string
  user_a_id: string
  user_b_id: string
  category: string
  color_hex: string
  activity_title: string
  formed_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  reference_id: string
  read: boolean
  created_at: string
}

export interface Category {
  slug: string
  label: string
  color_hex: string
  keywords: string[]
}

export interface Post {
  id: string
  bridge_id: string
  author_id: string
  body: string
  is_public: boolean
  created_at: string
}

export interface Reaction {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
}
