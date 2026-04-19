import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'

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

interface UseBridgesParams {
  otherUserId?: string
}

interface UseBridgesResult {
  bridges: Bridge[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useBridges({
  otherUserId,
}: UseBridgesParams = {}): UseBridgesResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBridges = useCallback(async () => {
    if (!userId) {
      setBridges([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('bridges')
      .select('*')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('formed_at', { ascending: false })

    if (otherUserId) {
      query = query.or(
        `and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`,
      )
    }

    const { data, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
      setBridges([])
      setLoading(false)
      return
    }

    setBridges((data ?? []) as Bridge[])
    setLoading(false)
  }, [otherUserId, userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    void loadBridges()
  }, [authLoading, loadBridges])

  return {
    bridges,
    loading: loading || authLoading,
    error,
    refetch: loadBridges,
  }
}
