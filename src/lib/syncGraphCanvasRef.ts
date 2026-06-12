import type { MutableRefObject } from 'react'

export const syncGraphCanvasRef = (
  container: HTMLElement | null,
  graphCanvasRef: MutableRefObject<HTMLCanvasElement | null> | undefined,
): boolean => {
  if (!graphCanvasRef || !container) {
    return false
  }

  const canvas = container.querySelector('canvas')
  if (!canvas) {
    return false
  }

  graphCanvasRef.current = canvas
  return true
}
