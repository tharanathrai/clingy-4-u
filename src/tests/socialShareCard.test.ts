import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  SOCIAL_SHARE_HEIGHT,
  SOCIAL_SHARE_WIDTH,
  composeSocialShareCard,
} from '../lib/socialShareCard.ts'
import type { SocialShareCardOptions } from '../lib/socialShareCard.ts'

const baseOptions: SocialShareCardOptions = {
  userName: 'Robin',
  userAvatarUrl: null,
  date: 'June 2026',
  peopleCount: 2,
  bridgeCount: 3,
  topCat: 'active',
  people: [
    { name: 'Sam', avatarUrl: null, topCat: 'recharge', sharedCount: 2 },
    { name: 'Mara', avatarUrl: null, topCat: 'playful', sharedCount: 1 },
  ],
}

describe('social share card layout constants', () => {
  it('uses a 1:1 square export size', () => {
    expect(SOCIAL_SHARE_WIDTH).toBe(1080)
    expect(SOCIAL_SHARE_HEIGHT).toBe(1080)
    expect(SOCIAL_SHARE_WIDTH / SOCIAL_SHARE_HEIGHT).toBe(1)
  })
})

describe('composeSocialShareCard', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        complete = false
        naturalWidth = 180
        naturalHeight = 180
        width = 180
        height = 180

        set src(_value: string) {
          this.complete = true
          queueMicrotask(() => {
            this.onload?.()
          })
        }
      },
    )

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    })

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        // Small pattern canvas (180×180)
        if (this.width === 180 && this.height === 180) {
          return {
            drawImage: vi.fn(),
            createPattern: vi.fn(() => ({})),
          } as unknown as CanvasRenderingContext2D
        }

        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          font: '',
          textAlign: 'left' as CanvasTextAlign,
          textBaseline: 'alphabetic' as CanvasTextBaseline,
          globalAlpha: 1,
          lineCap: 'butt' as CanvasLineCap,
          fillRect: vi.fn(),
          stroke: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          quadraticCurveTo: vi.fn(),
          closePath: vi.fn(),
          arc: vi.fn(),
          clip: vi.fn(),
          fill: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn(() => ({ width: 80 })),
          createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          createPattern: vi.fn(() => ({})),
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
        } as unknown as CanvasRenderingContext2D
      },
    )

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,YWJj',
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a composed PNG from options alone', async () => {
    const result = await composeSocialShareCard(baseOptions)

    expect(result).not.toBeNull()
    expect(result?.blob.type).toBe('image/png')
    expect(result?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('returns null when the composer canvas context is unavailable', async () => {
    getContextSpy.mockReturnValue(null)

    await expect(composeSocialShareCard(baseOptions)).resolves.toBeNull()
  })

  it('handles empty people array without throwing', async () => {
    const result = await composeSocialShareCard({
      ...baseOptions,
      peopleCount: 0,
      bridgeCount: 0,
      topCat: 'explore',
      people: [],
    })

    expect(result).not.toBeNull()
  })
})
