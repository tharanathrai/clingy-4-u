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
}

interface UseGumPiecesResult {
  pieces: GumPiece[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useGumPieces(): UseGumPiecesResult {
  const { user, loading: authLoading } = useAuth()
  const [pieces, setPieces] = useState<GumPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPieces = useCallback(async () => {
    if (!user) {
      setPieces([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('gum_pieces')
      .select('*')
      .in('status', ['placeholder', 'active'])
      .or(`creator_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setPieces([])
      setLoading(false)
      return
    }

    setPieces((data ?? []) as GumPiece[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadPieces()
  }, [authLoading, loadPieces])

  useEffect(() => {
    if (!user) {
      return
    }

    const channel = supabase
      .channel(`gum-pieces-${user.id}`)
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
  }, [loadPieces, user])

  return {
    pieces,
    loading: loading || authLoading,
    error,
    refetch: loadPieces,
  }
}
