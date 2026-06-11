/**
 * True only on first fetch with no cached data — not during background refetch.
 */
export function isInitialQueryLoading(
  authLoading: boolean,
  userId: string | null,
  isPending: boolean,
): boolean {
  if (!userId && authLoading) {
    return true
  }
  return isPending
}
