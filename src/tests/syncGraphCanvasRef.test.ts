/**
 * Tests for graph canvas ref binding (spec 016)
 */

import { describe, expect, it } from 'vitest'
import { syncGraphCanvasRef } from '../lib/syncGraphCanvasRef.ts'

describe('syncGraphCanvasRef', () => {
  it('assigns the canvas element from the graph container', () => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    container.appendChild(canvas)
    const graphCanvasRef = { current: null as HTMLCanvasElement | null }

    expect(syncGraphCanvasRef(container, graphCanvasRef)).toBe(true)
    expect(graphCanvasRef.current).toBe(canvas)
  })

  it('returns false when no canvas is mounted yet', () => {
    const container = document.createElement('div')
    const graphCanvasRef = { current: null as HTMLCanvasElement | null }

    expect(syncGraphCanvasRef(container, graphCanvasRef)).toBe(false)
    expect(graphCanvasRef.current).toBeNull()
  })
})
