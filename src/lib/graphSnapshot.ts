import { composeSocialShareCard, type SocialShareCardOptions } from './socialShareCard.ts'

export const getGraphSnapshotFileName = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `my-bridges-${year}-${month}-${day}.png`
}

export const buildSocialShareSnapshot = async (
  options: SocialShareCardOptions,
): Promise<{ blob: Blob; dataUrl: string } | null> => {
  return composeSocialShareCard(options)
}

export const canShareGraphFiles = (): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false
  }

  try {
    const probe = new File([''], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}
