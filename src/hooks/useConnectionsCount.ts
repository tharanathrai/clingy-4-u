import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import { supabase } from '../lib/supabase.ts'

async function fetchConnectionsCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
  return count ?? 0
}

/**
 * Active-connection count for the current user. Shares the `connectionsCount` query cache
 * across tabs (Home, Feed, Notifications) so empty states can gate their CTA without refetching.
 */
export function useConnectionsCount() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const { data: connectionsCount = 0, isPending } = useQuery({
    queryKey: queryKeys.connectionsCount(userId),
    queryFn: () => fetchConnectionsCount(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: Infinity,
  })

  return {
    connectionsCount,
    loading: isInitialQueryLoading(authLoading, userId, isPending),
  }
}
