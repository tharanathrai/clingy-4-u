import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'

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

const gumPiecesCache = new Map<string, GumPiece[]>()

export function useGumPieces(): UseGumPiecesResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [pieces, setPieces] = useState<GumPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPieces = useCallback(async () => {
    if (!userId) {
      setPieces([])
      setLoading(false)
      setError(null)
      return
    }

    const cached = gumPiecesCache.get(userId)
    if (cached) {
      setPieces(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const { data, error: queryError } = await supabase
      .from('gum_pieces')
      .select('*')
      .in('status', ['placeholder', 'active'])
      .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      if (!cached) {
        setPieces([])
      }
      setLoading(false)
      return
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

    const nextPieces = rawPieces.map((piece) => ({
      ...piece,
      creator_display_name: nameById.get(piece.creator_id),
      recipient_display_name: nameById.get(piece.recipient_id),
    }))
    gumPiecesCache.set(userId, nextPieces)
    setPieces(nextPieces)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadPieces()
  }, [authLoading, loadPieces])

  useEffect(() => {
    if (!userId) {
      return
    }

    const channel = supabase
      .channel(`gum-pieces-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gum_pieces',
        },
        () => {
          void loadPieces()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadPieces, userId])

  return {
    pieces,
    loading: loading || authLoading,
    error,
    refetch: loadPieces,
  }
}
