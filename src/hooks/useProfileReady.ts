/**
 * Checks whether the current user has completed onboarding (i.e. has a row in
 * public.users). Uses React Query so the result is cached, deduplicated, and
 * can be imperatively invalidated after onboarding completes.
 *
 * staleTime: 0 ensures we re-check on the /welcome route so a just-completed
 * onboarding is picked up without a manual page reload.
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
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.profileReady(userId),
    queryFn: () => checkProfileReady(userId!),
    enabled: userId !== null,
    // Always re-check; auth redirects depend on fresh data
    staleTime: 0,
    // Don't retry — a 404 is definitively "not ready", not a transient error
    retry: false,
  })

  return {
    profileReady: data ?? null,
    isLoading,
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
