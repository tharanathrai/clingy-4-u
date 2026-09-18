import { avatarObjectPath, avatarPathFromUrl } from '../lib/avatarCleanup.ts'
import { supabase } from '../lib/supabase.ts'

interface UploadAvatarOptions {
  upsert: boolean
}

export async function uploadAvatar(
  userId: string,
  blob: Blob,
  options: UploadAvatarOptions,
): Promise<string> {
  // Random object id rather than Date.now(): the bucket is public, so a
  // timestamped name is guessable from a known signup time.
  const filePath = avatarObjectPath(userId, crypto.randomUUID())
  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, {
    upsert: options.upsert,
    contentType: 'image/jpeg',
  })

  if (uploadError) {
    throw uploadError
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filePath)

  return publicUrl
}

/**
 * Remove the storage object an avatar URL points at.
 *
 * The bucket is public, so an object left behind stays fetchable by anyone
 * holding its URL -- including after the user has "removed" their photo. The
 * path is derived from the URL because there is no SELECT policy on
 * storage.objects, so listing the prefix from the browser returns nothing.
 *
 * Best-effort by design: it swallows failures so a storage hiccup cannot block
 * someone changing their display name. Anything it misses is swept up by
 * supabase/scripts/prune-orphan-avatars.md.
 *
 * Call this only AFTER the users row no longer points at the object, so a
 * failed profile update never leaves a live avatar_url aimed at a deleted file.
 */
export async function removeAvatarByUrl(avatarUrl: string | null): Promise<void> {
  const path = avatarPathFromUrl(avatarUrl)
  if (!path) return

  try {
    await supabase.storage.from('avatars').remove([path])
  } catch {
    // Orphaned object; the prune script is the backstop.
  }
}
