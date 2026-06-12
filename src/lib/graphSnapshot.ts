import { composeSocialShareCard, type SocialShareCardOptions } from './socialShareCard.ts'

const EXPORT_SCALE = 2

export const getGraphSnapshotFileName = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `my-bridges-${year}-${month}-${day}.png`
}

export const captureGraphBitmap = (
  sourceCanvas: HTMLCanvasElement,
  scale = EXPORT_SCALE,
): HTMLCanvasElement | null => {
  const snapshot = document.createElement('canvas')
  snapshot.width = sourceCanvas.width * scale
  snapshot.height = sourceCanvas.height * scale
  const context = snapshot.getContext('2d')
  if (!context) {
    return null
  }

  context.drawImage(
    sourceCanvas,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
    0,
    0,
    snapshot.width,
    snapshot.height,
  )

  return snapshot
}

export const buildSocialShareSnapshot = async (
  sourceCanvas: HTMLCanvasElement,
  options: SocialShareCardOptions,
): Promise<{ blob: Blob; dataUrl: string } | null> => {
  const graphBitmap = captureGraphBitmap(sourceCanvas)
  if (!graphBitmap) {
    return null
  }

  return composeSocialShareCard(graphBitmap, options)
}

/** @deprecated Use buildSocialShareSnapshot for share/save exports. */
export const captureGraphSnapshot = (
  sourceCanvas: HTMLCanvasElement,
): { blob: Blob; dataUrl: string } | null => {
  const graphBitmap = captureGraphBitmap(sourceCanvas)
  if (!graphBitmap) {
    return null
  }

  const dataUrl = graphBitmap.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const blob = new Blob([bytes], { type: 'image/png' })

  return { blob, dataUrl }
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
