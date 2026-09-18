/**
 * Pure helpers for avatar object cleanup.
 *
 * The `avatars` bucket is public and `uploadAvatar` writes a new object on every
 * change without removing the previous one, so a user accumulates publicly
 * fetchable images -- including ones they thought they had removed. These
 * helpers decide which objects under a user's prefix are orphans. Kept free of
 * the storage client so the selection rules are unit-testable.
 */

/** Shape of the entries `storage.from('avatars').list(prefix)` returns. */
export interface StorageEntry {
  name: string
  /** null for folder placeholders, which carry no object to remove. */
  id?: string | null
}

/** Storage object path for a freshly uploaded avatar. */
export function avatarObjectPath(userId: string, objectId: string): string {
  return `${userId}/${objectId}.jpg`
}

/**
 * Recover the storage object path from a stored avatar URL.
 *
 * This is how the live cleanup path finds the object to remove: there is no
 * SELECT policy on storage.objects, so an authenticated client cannot `list()`
 * its own prefix (it silently returns an empty array). The profile row already
 * knows the current object, so we derive the path from the URL instead of
 * enumerating. Returns null for anything that is not an avatars-bucket URL.
 */
export function avatarPathFromUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  const marker = '/avatars/'
  const at = avatarUrl.indexOf(marker)
  if (at === -1) return null
  const path = avatarUrl.slice(at + marker.length).split('?')[0]
  // Expect exactly `<userId>/<file>`; anything else is not ours to delete.
  return /^[^/]+\/[^/]+$/.test(path) ? path : null
}

/**
 * Full object paths under a user's prefix, skipping folder placeholders.
 * Supabase's `list` returns nested prefixes with `id: null`; passing those to
 * `.remove()` silently removes nothing, which is the failure mode that makes
 * cleanup look like it worked.
 */
export function avatarPathsFromList(userId: string, entries: StorageEntry[]): string[] {
  return entries
    .filter((entry) => entry.id !== null && entry.id !== undefined && entry.name !== '')
    .map((entry) => `${userId}/${entry.name}`)
}

/**
 * Paths to remove: everything under the prefix except the object the profile
 * currently points at. A null `liveAvatarUrl` means the user has no avatar, so
 * every object is an orphan.
 *
 * Matching is by path suffix rather than string equality because the stored
 * value is a full public URL (`https://<ref>.supabase.co/storage/v1/object/public/avatars/<path>`)
 * and may carry a cache-busting query string.
 */
export function orphanAvatarPaths(
  userId: string,
  entries: StorageEntry[],
  liveAvatarUrl: string | null,
): string[] {
  const allPaths = avatarPathsFromList(userId, entries)
  if (!liveAvatarUrl) return allPaths

  const livePath = liveAvatarUrl.split('?')[0]
  return allPaths.filter((path) => !livePath.endsWith(`/${path}`))
}

/** Split paths into batches; the storage API caps `remove` per call. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}
