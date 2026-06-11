/**
 * Checks whether the current user has completed onboarding (i.e. has a row in
 * public.users). Uses React Query so the result is cached, deduplicated, and
 * can be imperatively updated after onboarding completes via markProfileReady.
 */

import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'

async function checkProfileReady(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export function useProfileReady(userId: string | null): {
  profileReady: boolean | null
  isLoading: boolean
} {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.profileReady(userId),
    queryFn: () => checkProfileReady(userId!),
    enabled: userId !== null,
    staleTime: Infinity,
    retry: false,
  })

  return {
    profileReady: data ?? null,
    isLoading: userId !== null && isPending,
  }
}

/**
 * Call after successful onboarding to immediately update the cache so
 * AuthGuard redirects to /add without waiting for a network round-trip.
 */
export function markProfileReady(
  userId: string,
  queryClient: QueryClient,
): void {
  queryClient.setQueryData(queryKeys.profileReady(userId), true)
}
