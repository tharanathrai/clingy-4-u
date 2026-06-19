import { CATEGORIES, type CategorySlug } from './constants.ts'

export const SOCIAL_SHARE_WIDTH = 1080
export const SOCIAL_SHARE_HEIGHT = 1080

const BG = '#080612'
const S = 3 // scale: 360 viewBox → 1080 canvas
const CX = 180 * S // 540 — centre X
const CY = 190 * S // 570 — centre Y
const YOU_R = 20 * S // 60 — centre avatar radius
const BAND_Y_MIN = 150 * S // 450
const BAND_Y_MAX = 250 * S // 750
const GAP = 10 * S // 30 — inter-node gap
const MIN_ORBIT_D = 80 * S // 240 — minimum centre-to-centre distance for any friend node
const PAD = 30 * S // 90 — edge padding

const ARCHETYPE: Record<CategorySlug, string> = {
  explore: 'Wanderer',
  intimate: 'Seeker',
  playful: 'Jester',
  support: 'Healer',
  active: 'Warrior',
  recharge: 'Dreamer',
  savor: 'Relisher',
}

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.85'/%3E%3C/svg%3E"

export interface ShareCardPerson {
  name: string
  avatarUrl: string | null
  topCat: CategorySlug
  sharedCount: number
}

export interface SocialShareCardOptions {
  userName: string
  userAvatarUrl: string | null
  date: string
  peopleCount: number
  bridgeCount: number
  topCat: CategorySlug
  people: ShareCardPerson[]
}

// ── Utilities ────────────────────────────────────────────────────────────────

const canvasToBlob = (canvas: HTMLCanvasElement): { blob: Blob; dataUrl: string } => {
  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type: 'image/png' }), dataUrl }
}

const rgba = (hex: string, alpha: number): string => {
  const v = hex.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const loadImage = (url: string | null): Promise<HTMLImageElement | null> => {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// ── Layout ───────────────────────────────────────────────────────────────────

interface NodeLayout {
  x: number
  y: number
  r: number
  seed: number
  person: ShareCardPerson
}

function computeLayout(people: ShareCardPerson[], userName: string): NodeLayout[] {
  if (people.length === 0) return []
  const rnd = mulberry32(hashStr(userName))
  const n = people.length
  const start = rnd() * Math.PI * 2

  const nodes: NodeLayout[] = people.map((p, i) => {
    const ang = start + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.66
    const depth = p.sharedCount / 6
    const rad = ((94 + rnd() * 44) - depth * 22) * S
    const x = CX + Math.cos(ang) * rad * 1.15
    const y = CY + Math.sin(ang) * rad * 0.5
    const r = ((30 + p.sharedCount * 3.4) / 2 + 9) * S
    return { x, y, r, seed: rnd(), person: p }
  })

  // 60-pass relaxation: push apart from centre + each other, clamp to band
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      let dx = a.x - CX
      let dy = a.y - CY
      let d = Math.hypot(dx, dy) || 0.01
      const minC = Math.max(a.r + YOU_R + GAP, MIN_ORBIT_D)
      if (d < minC) {
        const push = minC - d
        a.x += (dx / d) * push
        a.y += (dy / d) * push
      }
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        dx = b.x - a.x
        dy = b.y - a.y
        d = Math.hypot(dx, dy) || 0.01
        const min = a.r + b.r + GAP
        if (d < min) {
          const push = (min - d) / 2
          const ux = dx / d
          const uy = dy / d
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
        }
      }
    }
    for (const a of nodes) {
      a.x = Math.max(a.r + 12 * S, Math.min(SOCIAL_SHARE_WIDTH - a.r - 12 * S, a.x))
      a.y = Math.max(BAND_Y_MIN, Math.min(BAND_Y_MAX, a.y))
    }
  }
  return nodes
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawStrands(ctx: CanvasRenderingContext2D, nodes: NodeLayout[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i]
    const col = CATEGORIES[nd.person.topCat].color_hex
    const s = nd.person.sharedCount
    const base = (11 + nd.seed * 9) * S
    const gapW = 3.2 * S
    const strands = Array.from({ length: s }, (_, k) => base + (k - (s - 1) / 2) * gapW)

    const mx = (CX + nd.x) / 2
    const my = (CY + nd.y) / 2
    const dx = nd.x - CX
    const dy = nd.y - CY
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const px = -dy / len
    const py = dx / len

    const strandPath = (off: number): void => {
      ctx.moveTo(CX, CY)
      ctx.quadraticCurveTo(mx + px * off, my + py * off, nd.x, nd.y)
    }

    // Glow background
    ctx.save()
    try {
      ctx.filter = 'blur(10px)'
    } catch {
      // filter unsupported — skip blur
    }
    ctx.beginPath()
    strandPath(base)
    ctx.strokeStyle = rgba(col, 0.12)
    ctx.lineWidth = (3 + s * 2) * S
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.save()
    try {
      ctx.filter = 'none'
    } catch {
      // ignore
    }
    ctx.restore()
    ctx.restore()

    // Individual strands
    for (const off of strands) {
      ctx.beginPath()
      strandPath(off)
      ctx.strokeStyle = rgba(col, 0.58)
      ctx.lineWidth = 1.5 * S
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Thin white highlight
    if (strands[0] !== undefined) {
      ctx.beginPath()
      strandPath(strands[0])
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 0.5 * S
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  }
}

function drawCircularAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  r: number,
  fallbackColor: string,
  fallbackInitial: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = fallbackColor
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `${Math.round(r * 1.1)}px "DM Sans"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((fallbackInitial[0] ?? '?').toUpperCase(), x, y)
  }
  ctx.restore()
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  lineWidth: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  color: string,
): void {
  const bw = 15 * S
  const bh = 15 * S
  const br = bh / 2

  // Gap ring (BG coloured)
  roundRect(ctx, x - bw / 2 - 2, y - bh / 2 - 2, bw + 4, bh + 4, br + 2)
  ctx.fillStyle = BG
  ctx.fill()

  // Pill
  roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, br)
  ctx.fillStyle = color
  ctx.fill()

  // Count label
  ctx.fillStyle = '#1a1320'
  ctx.font = `700 ${9.5 * S}px "DM Sans"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), x, y)
}

function tierOf(n: number): string {
  if (n >= 28) return 'Architect'
  if (n >= 18) return 'Weaver'
  if (n >= 11) return 'Connector'
  if (n >= 6) return 'Spark'
  return 'Seed'
}

function drawCategoryChip(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  centreY: number,
  cat: CategorySlug,
): void {
  const label = CATEGORIES[cat].label
  const col = CATEGORIES[cat].color_hex
  const dotR = 7 * S
  const fontSize = 10 * S
  ctx.font = `${fontSize}px "DM Sans"`
  const textW = ctx.measureText(label).width
  const chipH = 26 * S
  const dotGap = 8 * S
  const chipPadL = 10 * S
  const chipPadR = 12 * S
  const chipW = chipPadL + dotR * 2 + dotGap + textW + chipPadR
  const chipR = chipH / 2
  const chipX = rightX - chipW

  // Background pill
  roundRect(ctx, chipX, centreY - chipH / 2, chipW, chipH, chipR)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Dot
  const dotX = chipX + chipPadL + dotR
  ctx.beginPath()
  ctx.arc(dotX, centreY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = col
  ctx.fill()

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `${fontSize}px "DM Sans"`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, dotX + dotR + dotGap, centreY)
}

const loadGrainPattern = async (ctx: CanvasRenderingContext2D): Promise<CanvasPattern | null> => {
  const pc = document.createElement('canvas')
  pc.width = 180
  pc.height = 180
  const pctx = pc.getContext('2d')
  if (!pctx) return null
  const img = await loadImage(GRAIN_SVG)
  if (!img) return null
  pctx.drawImage(img, 0, 0, 180, 180)
  return ctx.createPattern(pc, 'repeat')
}

// ── Main composer ────────────────────────────────────────────────────────────

export const composeSocialShareCard = async (
  options: SocialShareCardOptions,
): Promise<{ blob: Blob; dataUrl: string } | null> => {
  const canvas = document.createElement('canvas')
  canvas.width = SOCIAL_SHARE_WIDTH
  canvas.height = SOCIAL_SHARE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  await document.fonts.ready

  const W = SOCIAL_SHARE_WIDTH
  const H = SOCIAL_SHARE_HEIGHT
  const topCatColor = CATEGORIES[options.topCat].color_hex
  const archetype = ARCHETYPE[options.topCat]
  const tier = tierOf(options.bridgeCount)

  // Load all avatars
  const [selfImg, ...friendImgs] = await Promise.all([
    loadImage(options.userAvatarUrl),
    ...options.people.map((p) => loadImage(p.avatarUrl)),
  ])

  const nodes = computeLayout(options.people, options.userName)

  // 1. Background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // 2. Colour radial overlays
  const rg1 = ctx.createRadialGradient(W * 0.22, H * 0.14, 0, W * 0.22, H * 0.14, W * 0.55)
  rg1.addColorStop(0, rgba(topCatColor, 0.12))
  rg1.addColorStop(1, rgba(topCatColor, 0))
  ctx.fillStyle = rg1
  ctx.fillRect(0, 0, W, H)

  const rg2 = ctx.createRadialGradient(W * 0.82, H * 0.9, 0, W * 0.82, H * 0.9, W * 0.5)
  rg2.addColorStop(0, rgba(CATEGORIES.intimate.color_hex, 0.07))
  rg2.addColorStop(1, rgba(CATEGORIES.intimate.color_hex, 0))
  ctx.fillStyle = rg2
  ctx.fillRect(0, 0, W, H)

  // 3. Strands
  drawStrands(ctx, nodes)

  // 4. Centre "You" — glow halo
  const halo = ctx.createRadialGradient(CX, CY, 0, CX, CY, YOU_R * 1.6)
  halo.addColorStop(0, rgba(topCatColor, 0.4))
  halo.addColorStop(1, rgba(topCatColor, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(CX, CY, YOU_R * 2, 0, Math.PI * 2)
  ctx.fill()

  // Ring: BG gap then colour ring
  drawRing(ctx, CX, CY, YOU_R + 7 * S, BG, 10 * S)
  drawRing(ctx, CX, CY, YOU_R + 2 * S, topCatColor, 4 * S)

  // You avatar
  drawCircularAvatar(ctx, selfImg ?? null, CX, CY, YOU_R, topCatColor, options.userName[0] ?? '?')

  // 5. Friend avatars
  nodes.forEach((nd, i) => {
    const p = nd.person
    const col = CATEGORIES[p.topCat].color_hex
    const avatarR = ((30 + p.sharedCount * 3.4) / 2) * S

    drawRing(ctx, nd.x, nd.y, avatarR + 5 * S, BG, 6 * S)
    drawRing(ctx, nd.x, nd.y, avatarR + 1.5 * S, col, 3 * S)
    drawCircularAvatar(ctx, friendImgs[i] ?? null, nd.x, nd.y, avatarR, col, p.name[0] ?? '?')

    if (p.sharedCount > 1) {
      const bx = nd.x + avatarR * Math.cos(Math.PI / 4)
      const by = nd.y + avatarR * Math.sin(Math.PI / 4)
      drawBadge(ctx, bx, by, p.sharedCount, col)
    }
  })

  // 6. Top gradient scrim
  const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.42)
  topScrim.addColorStop(0, BG)
  topScrim.addColorStop(0.5, rgba(BG, 0.82))
  topScrim.addColorStop(1, rgba(BG, 0))
  ctx.fillStyle = topScrim
  ctx.fillRect(0, 0, W, H * 0.42)

  // 7. Bottom gradient scrim
  const botScrim = ctx.createLinearGradient(0, H, 0, H * 0.58)
  botScrim.addColorStop(0, BG)
  botScrim.addColorStop(0.5, rgba(BG, 0.82))
  botScrim.addColorStop(1, rgba(BG, 0))
  ctx.fillStyle = botScrim
  ctx.fillRect(0, H * 0.58, W, H * 0.42)

  // 8. Top text — user name (left) + "clingy" (right)
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `500 ${17 * S}px "DM Sans"`
  ctx.textAlign = 'left'
  ctx.fillText(options.userName, PAD, PAD)

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `${17 * S}px "Bagel Fat One"`
  ctx.textAlign = 'right'
  ctx.fillText('clingy', W - PAD, PAD)

  // Tier (left) + date (right)
  const metaSize = 10.5 * S
  const metaY = PAD + 17 * S + 14 * S
  ctx.font = `${metaSize}px "DM Sans"`
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.textAlign = 'left'
  ctx.fillText(tier.toUpperCase(), PAD, metaY)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'right'
  ctx.fillText(options.date.toUpperCase(), W - PAD, metaY)

  // Archetype title
  const titleY = metaY + metaSize + 6 * S
  ctx.fillStyle = topCatColor
  ctx.font = `${35 * S}px "Bagel Fat One"`
  ctx.textAlign = 'left'
  ctx.fillText(`The ${archetype}`, PAD, titleY)

  // 9. Bottom text
  const statNumSize = 30 * S
  const statLabelSize = 10 * S
  const statColGap = 30 * S
  const bottomBase = H - PAD

  // Measure bridge number width for second column placement
  ctx.font = `${statNumSize}px "Bagel Fat One"`
  const bridgeNumW = ctx.measureText(String(options.bridgeCount)).width

  const bridgeLabel = options.bridgeCount === 1 ? 'BRIDGE' : 'BRIDGES'
  const peopleLabel = options.peopleCount === 1 ? 'PERSON' : 'PEOPLE'

  // Bridge count + label
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.font = `${statNumSize}px "Bagel Fat One"`
  ctx.fillText(String(options.bridgeCount), PAD, bottomBase - statLabelSize - 4 * S)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${statLabelSize}px "DM Sans"`
  ctx.fillText(bridgeLabel, PAD, bottomBase)

  // People count + label
  const col2X = PAD + bridgeNumW + statColGap
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.font = `${statNumSize}px "Bagel Fat One"`
  ctx.fillText(String(options.peopleCount), col2X, bottomBase - statLabelSize - 4 * S)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${statLabelSize}px "DM Sans"`
  ctx.fillText(peopleLabel, col2X, bottomBase)

  // Top vibe label + chip
  const chipCentreY = bottomBase - 13 * S
  const vibeLabel = 'TOP VIBE'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${statLabelSize}px "DM Sans"`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(vibeLabel, W - PAD, chipCentreY - 13 * S - 6 * S)

  drawCategoryChip(ctx, W - PAD, chipCentreY, options.topCat)

  // 10. Grain overlay
  const grainPattern = await loadGrainPattern(ctx)
  if (grainPattern) {
    ctx.save()
    ctx.globalAlpha = 0.035
    ctx.fillStyle = grainPattern
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  return canvasToBlob(canvas)
}
