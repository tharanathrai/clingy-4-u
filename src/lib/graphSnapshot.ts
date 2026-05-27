const GRAPH_BG = '#12101A'
const EXPORT_SCALE = 2

export const getGraphSnapshotFileName = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `my-bridges-${year}-${month}-${day}.png`
}

export const captureGraphSnapshot = (
  sourceCanvas: HTMLCanvasElement,
): { blob: Blob; dataUrl: string } | null => {
  const side = Math.max(sourceCanvas.width, sourceCanvas.height) * EXPORT_SCALE
  const snapshot = document.createElement('canvas')
  snapshot.width = side
  snapshot.height = side
  const context = snapshot.getContext('2d')
  if (!context) {
    return null
  }

  context.fillStyle = GRAPH_BG
  context.fillRect(0, 0, snapshot.width, snapshot.height)

  const drawWidth = sourceCanvas.width * EXPORT_SCALE
  const drawHeight = sourceCanvas.height * EXPORT_SCALE
  const offsetX = (side - drawWidth) / 2
  const offsetY = (side - drawHeight) / 2
  context.drawImage(
    sourceCanvas,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
  )

  const dataUrl = snapshot.toDataURL('image/png')
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
