/**
 * Centralised React Query key registry.
 *
 * All queryKey arrays must be constructed here, not inline in hooks or pages.
 * This makes key mismatches impossible and invalidation safe across the codebase.
 */

export const queryKeys = {
  gumPieces: (userId: string | null) => ['gum-pieces', userId] as const,

  notifications: (userId: string | null) => ['notifications', userId] as const,

  networkGraph: (userId: string | null) => ['network-graph', userId] as const,

  pendingRequestCount: (userId: string | null) =>
    ['pending-request-count', userId] as const,

  bridgesPair: (userId: string | null, otherUserId: string) =>
    ['bridges-pair', userId, otherUserId] as const,

  bridgesPairPrefix: (userId: string | null) => ['bridges-pair', userId] as const,

  bridges: (userId: string | null, otherUserId?: string | null) =>
    ['bridges', userId, otherUserId ?? null] as const,

  profile: (identifier: string, byUserId: boolean, viewerId: string | null) =>
    [identifier, byUserId ? 'id' : 'username', viewerId] as const,

  profileReady: (userId: string | null) => ['profile-ready', userId] as const,

  pieceDetail: (id: string | undefined, userId: string | null) =>
    ['piece-detail', id, userId] as const,

  confirmationSession: (gumPieceId: string | null) =>
    ['confirmation-session', gumPieceId] as const,

  feed: (userId: string | null) => ['feed', userId] as const,

  post: (postId: string, userId: string | null) => ['post', postId, userId] as const,
}
