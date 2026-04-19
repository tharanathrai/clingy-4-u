import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import type { Bridge } from '../types/index.ts'
import { useAuth } from './useAuth.ts'

interface UseBridgesByPairParams {
  otherUserId: string
}

interface UseBridgesByPairResult {
  bridges: Bridge[]
  loading: boolean
  error: string | null
}

export function useBridgesByPair({
  otherUserId,
}: UseBridgesByPairParams): UseBridgesByPairResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId || !otherUserId) {
      setBridges([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const loadBridgesByPair = async () => {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('bridges')
        .select('*')
        .or(
          `and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`,
        )
        .order('formed_at', { ascending: false })

      if (cancelled) {
        return
      }

      if (queryError) {
        setError(queryError.message)
        setBridges([])
        setLoading(false)
        return
      }

      setBridges((data ?? []) as Bridge[])
      setLoading(false)
    }

    void loadBridgesByPair()

    return () => {
      cancelled = true
    }
  }, [authLoading, otherUserId, userId])

  return {
    bridges,
    loading: loading || authLoading,
    error,
  }
}
