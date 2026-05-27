import { supabase } from '../lib/supabase.ts'

interface UploadAvatarOptions {
  upsert: boolean
}

export async function uploadAvatar(
  userId: string,
  blob: Blob,
  options: UploadAvatarOptions,
): Promise<string> {
  const filePath = `${userId}/${Date.now()}.jpg`
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
