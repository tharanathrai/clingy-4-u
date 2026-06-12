/**
 * Tests for social share card composer (spec 016-social-share-export)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  SOCIAL_SHARE_HEIGHT,
  SOCIAL_SHARE_WIDTH,
  composeSocialShareCard,
  getSocialShareFooterHeight,
  getSocialShareGraphHeight,
} from '../lib/socialShareCard.ts'

describe('social share card layout constants', () => {
  it('uses a 4:5 portrait export size', () => {
    expect(SOCIAL_SHARE_WIDTH).toBe(1080)
    expect(SOCIAL_SHARE_HEIGHT).toBe(1350)
    expect(SOCIAL_SHARE_WIDTH / SOCIAL_SHARE_HEIGHT).toBeCloseTo(0.8, 2)
  })

  it('reserves roughly eighteen percent for the footer band', () => {
    expect(getSocialShareFooterHeight()).toBe(243)
    expect(getSocialShareGraphHeight()).toBe(1107)
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
        if (this.width === 200 && this.height === 100) {
          return {
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D
        }

        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          font: '',
          textAlign: 'left',
          textBaseline: 'alphabetic',
          globalAlpha: 1,
          fillRect: vi.fn(),
          stroke: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          fillText: vi.fn(),
          createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
          })),
          createPattern: vi.fn(() => ({})),
          save: vi.fn(),
          restore: vi.fn(),
          drawImage: vi.fn(),
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

  it('returns a composed PNG at social card dimensions', async () => {
    const graphBitmap = document.createElement('canvas')
    graphBitmap.width = 200
    graphBitmap.height = 100

    const result = await composeSocialShareCard(graphBitmap, {
      peopleCount: 2,
      bridgeCount: 3,
      glowColor: '#7DD47A',
    })

    expect(result).not.toBeNull()
    expect(result?.blob.type).toBe('image/png')
    expect(result?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('returns null when the composer canvas context is unavailable', async () => {
    getContextSpy.mockReturnValue(null)
    const graphBitmap = document.createElement('canvas')

    await expect(
      composeSocialShareCard(graphBitmap, {
        peopleCount: 0,
        bridgeCount: 0,
        glowColor: '#CF8EE8',
      }),
    ).resolves.toBeNull()
  })
})
