/**
 * Centralised cache invalidation helpers.
 *
 * Cross-flow invalidations (e.g. accepting a connection should refresh both the
 * network graph AND the pending-request counter) live here — not scattered across
 * page files.
 */

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys.ts'

export function invalidateNetworkGraph(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  void queryClient.invalidateQueries({ queryKey: queryKeys.networkGraph(userId) })
}

export function invalidatePendingRequestCount(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  void queryClient.invalidateQueries({ queryKey: queryKeys.pendingRequestCount(userId) })
}

export function invalidateGumPieces(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  void queryClient.invalidateQueries({ queryKey: queryKeys.gumPieces(userId) })
}

export function invalidateBridgesPair(
  userId: string | null | undefined,
  queryClient: QueryClient,
  otherUserId?: string,
): void {
  if (!userId) return
  if (otherUserId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bridgesPair(userId, otherUserId) })
    return
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.bridgesPairPrefix(userId) })
}

/**
 * Call after a connection is accepted/rejected — refreshes every view that
 * shows connection-dependent data.
 */
export function invalidateConnectionFlow(
  userId: string | null | undefined,
  queryClient: QueryClient,
): void {
  invalidateNetworkGraph(userId, queryClient)
  invalidatePendingRequestCount(userId, queryClient)
}
