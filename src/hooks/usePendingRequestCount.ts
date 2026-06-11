import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { debouncedInvalidateQueries } from '../lib/debouncedInvalidate.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

async function fetchPendingRequestCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .neq('requested_by', userId)
  return count ?? 0
}

export function usePendingRequestCount(): number {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const qk = queryKeys.pendingRequestCount(userId)

  const { data: pendingRequestCount = 0 } = useQuery({
    queryKey: qk,
    queryFn: () => fetchPendingRequestCount(userId!),
    enabled: userId !== null,
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    if (!userId) return
    return subscribePostgresChannel(`network-pending-requests-${userId}`, [
      {
        event: '*',
        table: 'connections',
        callback: () => { debouncedInvalidateQueries(queryClient, qk) },
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, userId])

  return pendingRequestCount
}
