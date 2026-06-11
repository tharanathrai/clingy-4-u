import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import type { Bridge } from '../types/index.ts'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'

interface UseBridgesByPairParams {
  otherUserId: string
}

interface UseBridgesByPairResult {
  bridges: Bridge[]
  loading: boolean
  error: string | null
}

async function fetchBridgesByPair(userId: string, otherUserId: string): Promise<Bridge[]> {
  const { data, error: queryError } = await supabase
    .from('bridges')
    .select('*')
    .or(
      `and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`,
    )
    .order('formed_at', { ascending: false })

  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as Bridge[]
}

export function useBridgesByPair({ otherUserId }: UseBridgesByPairParams): UseBridgesByPairResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.bridgesPair(userId, otherUserId),
    queryFn: () => fetchBridgesByPair(userId!, otherUserId),
    enabled: !authLoading && userId !== null && Boolean(otherUserId),
    staleTime: Infinity,
  })

  return {
    bridges: data ?? [],
    loading: isInitialQueryLoading(authLoading, userId, isPending),
    error: error instanceof Error ? error.message : null,
  }
}

export function invalidateBridgesByPairCache(userId: string, queryClient: QueryClient, otherUserId?: string): void {
  if (otherUserId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bridgesPair(userId, otherUserId) })
    return
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.bridgesPairPrefix(userId) })
}
