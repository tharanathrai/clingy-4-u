import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { debouncedInvalidateQueries } from '../lib/debouncedInvalidate.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'
import type { GumPieceMember, PendingEdit } from '../types/index.ts'

export interface GumPiece {
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
  pending_edit: PendingEdit | null
  members: GumPieceMember[]
}

interface UseGumPiecesResult {
  pieces: GumPiece[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

async function fetchGumPieces(userId: string): Promise<GumPiece[]> {
  // Step 1: Get piece IDs where this user is a member
  const { data: memberRows, error: memberError } = await supabase
    .from('gum_piece_members')
    .select('gum_piece_id')
    .eq('user_id', userId)

  if (memberError) throw new Error(memberError.message)

  const pieceIds = (memberRows ?? []).map((r) => r.gum_piece_id as string)
  if (pieceIds.length === 0) return []

  // Step 2: Fetch active/placeholder pieces from those IDs
  const { data: rawPieces, error: piecesError } = await supabase
    .from('gum_pieces')
    .select('*')
    .in('id', pieceIds)
    .in('status', ['placeholder', 'active'])
    .order('created_at', { ascending: false })

  if (piecesError) throw new Error(piecesError.message)
  if (!rawPieces || rawPieces.length === 0) return []

  const activePieceIds = rawPieces.map((p) => p.id as string)

  // Step 3: Fetch all members for those pieces with user profiles
  const { data: allMemberRows, error: allMembersError } = await supabase
    .from('gum_piece_members')
    .select('id, gum_piece_id, user_id, role, status, invited_at, responded_at')
    .in('gum_piece_id', activePieceIds)

  if (allMembersError) throw new Error(allMembersError.message)

  const memberUserIds = Array.from(
    new Set((allMemberRows ?? []).map((m) => m.user_id as string)),
  )

  const nameById = new Map<string, string>()
  const usernameById = new Map<string, string>()
  const avatarById = new Map<string, string | null>()

  if (memberUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', memberUserIds)

    for (const row of userRows ?? []) {
      nameById.set(row.id as string, row.display_name as string)
      usernameById.set(row.id as string, row.username as string)
      avatarById.set(row.id as string, row.avatar_url as string | null)
    }
  }

  // Group members by piece
  const membersByPiece = new Map<string, GumPieceMember[]>()
  for (const m of allMemberRows ?? []) {
    const pieceId = m.gum_piece_id as string
    const list = membersByPiece.get(pieceId) ?? []
    list.push({
      id: m.id as string,
      gum_piece_id: pieceId,
      user_id: m.user_id as string,
      role: m.role as GumPieceMember['role'],
      status: m.status as GumPieceMember['status'],
      invited_at: m.invited_at as string,
      responded_at: m.responded_at as string | null,
      display_name: nameById.get(m.user_id as string),
      username: usernameById.get(m.user_id as string),
      avatar_url: avatarById.get(m.user_id as string),
    })
    membersByPiece.set(pieceId, list)
  }

  return rawPieces.map((piece) => ({
    ...piece,
    recipient_id: piece.recipient_id ?? null,
    members: membersByPiece.get(piece.id as string) ?? [],
  })) as GumPiece[]
}

export function useGumPieces(): UseGumPiecesResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const qk = queryKeys.gumPieces(userId)

  const { data, isPending, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchGumPieces(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!userId) return
    return subscribePostgresChannel(`gum-pieces-rt-${userId}`, [
      {
        event: '*',
        table: 'gum_pieces',
        callback: () => { debouncedInvalidateQueries(queryClient, qk) },
      },
      {
        event: '*',
        table: 'gum_piece_members',
        callback: () => { debouncedInvalidateQueries(queryClient, qk) },
      },
    ])
  // qk is derived from userId — including it would rebuild the array every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, userId])

  return {
    pieces: data ?? [],
    loading: isInitialQueryLoading(authLoading, userId, isPending),
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: qk })
    },
  }
}
