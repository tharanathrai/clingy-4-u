import { formatShareStatLine } from './networkShareStats.ts'

export const SOCIAL_SHARE_WIDTH = 1080
export const SOCIAL_SHARE_HEIGHT = 1350
export const SOCIAL_SHARE_FOOTER_RATIO = 0.18
export const SOCIAL_SHARE_PADDING = 48

const GRAPH_BG = '#12101A'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT_PRIMARY = '#F2EFF8'
const TEXT_SECONDARY = '#9B93B8'
const TEXT_TERTIARY = '#5C5478'
const ACCENT = '#CF8EE8'

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.85'/%3E%3C/svg%3E"

export interface SocialShareCardOptions {
  peopleCount: number
  bridgeCount: number
  glowColor: string
}

export const getSocialShareFooterHeight = (): number => {
  return Math.round(SOCIAL_SHARE_HEIGHT * SOCIAL_SHARE_FOOTER_RATIO)
}

export const getSocialShareGraphHeight = (): number => {
  return SOCIAL_SHARE_HEIGHT - getSocialShareFooterHeight()
}

const canvasToBlob = (canvas: HTMLCanvasElement): { blob: Blob; dataUrl: string } => {
  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return { blob: new Blob([bytes], { type: 'image/png' }), dataUrl }
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized
  const parsed = Number.parseInt(value, 16)
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

const drawGlow = (
  context: CanvasRenderingContext2D,
  glowColor: string,
  hasBridges: boolean,
  graphHeight: number,
) => {
  const { r, g, b } = hexToRgb(hasBridges ? glowColor : ACCENT)
  const alpha = hasBridges ? 0.15 : 0.1
  const centerX = SOCIAL_SHARE_WIDTH / 2
  const centerY = graphHeight / 2
  const radius = Math.max(SOCIAL_SHARE_WIDTH, graphHeight) * 0.55
  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, SOCIAL_SHARE_WIDTH, graphHeight)
}

const drawGraphBitmap = (
  context: CanvasRenderingContext2D,
  graphBitmap: HTMLCanvasElement,
  graphHeight: number,
) => {
  const regionWidth = SOCIAL_SHARE_WIDTH - SOCIAL_SHARE_PADDING * 2
  const regionHeight = graphHeight - SOCIAL_SHARE_PADDING * 2
  const scale = Math.min(
    regionWidth / graphBitmap.width,
    regionHeight / graphBitmap.height,
  )
  const drawWidth = graphBitmap.width * scale
  const drawHeight = graphBitmap.height * scale
  const offsetX = (SOCIAL_SHARE_WIDTH - drawWidth) / 2
  const offsetY = SOCIAL_SHARE_PADDING + (regionHeight - drawHeight) / 2

  context.drawImage(graphBitmap, offsetX, offsetY, drawWidth, drawHeight)
}

const drawFooter = async (
  context: CanvasRenderingContext2D,
  options: SocialShareCardOptions,
  footerTop: number,
  footerHeight: number,
) => {
  await document.fonts.ready

  context.fillStyle = 'rgba(30, 27, 46, 0.85)'
  context.fillRect(0, footerTop, SOCIAL_SHARE_WIDTH, footerHeight)

  context.strokeStyle = BORDER
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(0, footerTop)
  context.lineTo(SOCIAL_SHARE_WIDTH, footerTop)
  context.stroke()

  const paddingX = SOCIAL_SHARE_PADDING
  let cursorY = footerTop + 36

  context.fillStyle = TEXT_PRIMARY
  context.font = '44px "Bagel Fat One"'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillText('my bridges', paddingX, cursorY)
  cursorY += 52

  context.fillStyle = TEXT_SECONDARY
  context.font = '26px "DM Sans"'
  context.fillText(formatShareStatLine(options.peopleCount, options.bridgeCount), paddingX, cursorY)
  cursorY += 40

  context.fillStyle = TEXT_PRIMARY
  context.font = '500 22px "DM Sans"'
  context.fillText('Sticky Bridges', paddingX, cursorY)

  context.fillStyle = TEXT_TERTIARY
  context.font = '20px "DM Sans"'
  context.fillText('time spent together', paddingX, cursorY + 30)
}

const loadGrainPattern = async (
  context: CanvasRenderingContext2D,
): Promise<CanvasPattern | null> => {
  const patternCanvas = document.createElement('canvas')
  patternCanvas.width = 180
  patternCanvas.height = 180
  const patternContext = patternCanvas.getContext('2d')
  if (!patternContext) {
    return null
  }

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => resolve(null)
    element.src = GRAIN_SVG
  })

  if (!image) {
    return null
  }

  patternContext.drawImage(image, 0, 0, 180, 180)
  return context.createPattern(patternCanvas, 'repeat')
}

const applyGrain = async (context: CanvasRenderingContext2D) => {
  const pattern = await loadGrainPattern(context)
  if (!pattern) {
    return
  }

  context.save()
  context.globalAlpha = 0.035
  context.fillStyle = pattern
  context.fillRect(0, 0, SOCIAL_SHARE_WIDTH, SOCIAL_SHARE_HEIGHT)
  context.restore()
}

export const composeSocialShareCard = async (
  graphBitmap: HTMLCanvasElement,
  options: SocialShareCardOptions,
): Promise<{ blob: Blob; dataUrl: string } | null> => {
  const canvas = document.createElement('canvas')
  canvas.width = SOCIAL_SHARE_WIDTH
  canvas.height = SOCIAL_SHARE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  const graphHeight = getSocialShareGraphHeight()
  const footerHeight = getSocialShareFooterHeight()

  context.fillStyle = GRAPH_BG
  context.fillRect(0, 0, SOCIAL_SHARE_WIDTH, SOCIAL_SHARE_HEIGHT)

  drawGlow(context, options.glowColor, options.bridgeCount > 0, graphHeight)
  drawGraphBitmap(context, graphBitmap, graphHeight)
  await drawFooter(context, options, graphHeight, footerHeight)
  await applyGrain(context)

  return canvasToBlob(canvas)
}
