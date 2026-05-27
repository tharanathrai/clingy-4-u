import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AVATAR_EXPORT_SIZE } from '../lib/constants.ts'
import { getCroppedImageBlob, revokeObjectUrl } from '../lib/avatarImage.ts'

describe('revokeObjectUrl', () => {
  it('revokes blob URLs when provided', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    revokeObjectUrl('blob:http://localhost/test')
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/test')
    revoke.mockRestore()
  })

  it('does nothing for null or undefined', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    revokeObjectUrl(null)
    revokeObjectUrl(undefined)
    expect(revoke).not.toHaveBeenCalled()
    revoke.mockRestore()
  })
})

describe('getCroppedImageBlob', () => {
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas')
        canvas.width = AVATAR_EXPORT_SIZE
        canvas.height = AVATAR_EXPORT_SIZE
        vi.spyOn(canvas, 'getContext').mockReturnValue({
          drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
          callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
        })
        return canvas
      }
      return originalCreateElement(tagName)
    })

    vi.stubGlobal(
      'Image',
      class MockImage {
        private _src = ''
        set src(value: string) {
          this._src = value
          queueMicrotask(() => {
            this.onload?.(new Event('load'))
          })
        }
        get src() {
          return this._src
        }
        onload: ((event: Event) => void) | null = null
        onerror: ((event: Event) => void) | null = null
        setAttribute = vi.fn()
        addEventListener(event: string, handler: (event: Event) => void) {
          if (event === 'load') {
            this.onload = handler
          }
          if (event === 'error') {
            this.onerror = handler
          }
        }
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a JPEG blob for a valid crop', async () => {
    const blob = await getCroppedImageBlob('blob:test', {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBeGreaterThan(0)
  })
})
