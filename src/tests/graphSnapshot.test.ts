/**
 * Tests for graph snapshot export (spec 016)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  captureGraphBitmap,
  captureGraphSnapshot,
  getGraphSnapshotFileName,
} from '../lib/graphSnapshot.ts'

describe('captureGraphSnapshot', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,YWJj',
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a PNG blob and data URL from a canvas', () => {
    const source = document.createElement('canvas')
    source.width = 120
    source.height = 80

    const snapshot = captureGraphSnapshot(source)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.blob.type).toBe('image/png')
    expect(snapshot?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('returns null when canvas context is unavailable', () => {
    getContextSpy.mockReturnValue(null)
    const source = document.createElement('canvas')

    expect(captureGraphSnapshot(source)).toBeNull()
  })
})

describe('captureGraphBitmap', () => {
  it('upscales the source canvas by the export scale', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    )

    const source = document.createElement('canvas')
    source.width = 120
    source.height = 80

    const bitmap = captureGraphBitmap(source)

    expect(bitmap?.width).toBe(240)
    expect(bitmap?.height).toBe(160)
    getContextSpy.mockRestore()
  })
})

describe('getGraphSnapshotFileName', () => {
  it('uses my-bridges prefix and date segments', () => {
    expect(getGraphSnapshotFileName()).toMatch(/^my-bridges-\d{4}-\d{2}-\d{2}\.png$/)
  })
})
