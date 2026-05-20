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

const bridgesByPairCache = new Map<string, Bridge[]>()

function pairCacheKey(userId: string, otherUserId: string): string {
  return `${userId}:${otherUserId}`
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

    const cacheKey = pairCacheKey(userId, otherUserId)
    const cached = bridgesByPairCache.get(cacheKey)
    if (cached) {
      setBridges(cached)
      setLoading(false)
      setError(null)
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

      const nextBridges = (data ?? []) as Bridge[]
      bridgesByPairCache.set(cacheKey, nextBridges)
      setBridges(nextBridges)
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

export function invalidateBridgesByPairCache(userId: string, otherUserId?: string): void {
  if (otherUserId) {
    bridgesByPairCache.delete(pairCacheKey(userId, otherUserId))
    return
  }

  for (const key of bridgesByPairCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      bridgesByPairCache.delete(key)
    }
  }
}
