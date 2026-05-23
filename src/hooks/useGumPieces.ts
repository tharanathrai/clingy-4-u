import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

export interface GumPiece {
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
  creator_display_name?: string
  recipient_display_name?: string
}

interface UseGumPiecesResult {
  pieces: GumPiece[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

async function fetchGumPieces(userId: string): Promise<GumPiece[]> {
  const { data, error: queryError } = await supabase
    .from('gum_pieces')
    .select('*')
    .in('status', ['placeholder', 'active'])
    .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (queryError) {
    throw new Error(queryError.message)
  }

  const rawPieces = (data ?? []) as GumPiece[]
  const participantIds = Array.from(
    new Set(rawPieces.flatMap((piece) => [piece.creator_id, piece.recipient_id])),
  )

  let nameById = new Map<string, string>()
  if (participantIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', participantIds)

    nameById = new Map(
      (userRows ?? []).map((row) => [row.id as string, row.display_name as string]),
    )
  }

  return rawPieces.map((piece) => ({
    ...piece,
    creator_display_name: nameById.get(piece.creator_id),
    recipient_display_name: nameById.get(piece.recipient_id),
  }))
}

export function useGumPieces(): UseGumPiecesResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const qk = queryKeys.gumPieces(userId)

  const { data, isLoading, error } = useQuery({
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
        callback: () => { void queryClient.invalidateQueries({ queryKey: qk }) },
      },
    ])
  // qk is derived from userId — including it would rebuild the array every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, userId])

  return {
    pieces: data ?? [],
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: qk })
    },
  }
}
