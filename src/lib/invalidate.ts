/**
 * Centralised cache invalidation helpers.
 *
 * Cross-flow invalidations (e.g. accepting a connection should refresh both the
 * network graph AND the pending-request counter) live here — not scattered across
 * page files.
 */

import type { QueryClient } from '@tanstack/react-query'
import { debouncedInvalidateQueries } from './debouncedInvalidate.ts'
import { queryKeys } from './queryKeys.ts'

export function invalidateNetworkGraph(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.networkGraph(userId))
}

export function invalidatePendingRequestCount(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.pendingRequestCount(userId))
}

export function invalidateConnectionsCount(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.connectionsCount(userId))
}

export function invalidateGumPieces(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.gumPieces(userId))
}

export function invalidateFeed(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.feed(userId))
}

export function invalidateNotifications(userId: string | null | undefined, queryClient: QueryClient): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.notifications(userId))
}

export function invalidatePost(
  postId: string,
  userId: string | null | undefined,
  queryClient: QueryClient,
): void {
  if (!userId) return
  debouncedInvalidateQueries(queryClient, queryKeys.post(postId, userId))
}

export function invalidatePieceDetail(
  pieceId: string | undefined,
  userId: string | null | undefined,
  queryClient: QueryClient,
): void {
  if (!userId || !pieceId) return
  debouncedInvalidateQueries(queryClient, queryKeys.pieceDetail(pieceId, userId))
}

export function invalidateProfile(
  identifier: string,
  byUserId: boolean,
  viewerId: string | null,
  queryClient: QueryClient,
): void {
  debouncedInvalidateQueries(queryClient, queryKeys.profile(identifier, byUserId, viewerId))
}

export function invalidateBridgesPair(
  userId: string | null | undefined,
  queryClient: QueryClient,
  otherUserId?: string,
): void {
  if (!userId) return
  if (otherUserId) {
    debouncedInvalidateQueries(queryClient, queryKeys.bridgesPair(userId, otherUserId))
    return
  }
  debouncedInvalidateQueries(queryClient, queryKeys.bridgesPairPrefix(userId))
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
  invalidateConnectionsCount(userId, queryClient)
}

/**
 * Call after gum piece create/respond — pocket, detail, and notifications.
 * Order: piece detail → gum pieces → notifications (detail first for status redirects).
 */
export function invalidateGumPieceFlow(
  userId: string | null | undefined,
  queryClient: QueryClient,
  pieceId?: string,
): void {
  if (pieceId) {
    invalidatePieceDetail(pieceId, userId, queryClient)
  }
  invalidateGumPieces(userId, queryClient)
  invalidateNotifications(userId, queryClient)
}

/**
 * Call after profile edit — refreshes profile cache for the viewer.
 */
export function invalidateProfileFlow(
  userId: string | null | undefined,
  queryClient: QueryClient,
): void {
  if (!userId) return
  invalidateProfile(userId, true, userId, queryClient)
}
