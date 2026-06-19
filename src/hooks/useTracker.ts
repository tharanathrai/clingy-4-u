import { useCallback, useEffect, useRef } from 'react'
import { track } from '../lib/analytics.ts'
import type { AnalyticsProps } from '../lib/analytics.ts'

interface UseTrackerResult {
  track: (eventName: string, props?: AnalyticsProps, surface?: string) => void
}

// Imperative tracking hook. Stable identity so it can sit in effect deps safely.
export function useTracker(): UseTrackerResult {
  const trackEvent = useCallback(
    (eventName: string, props?: AnalyticsProps, surface?: string) => {
      track(eventName, props, surface)
    },
    [],
  )
  return { track: trackEvent }
}

// Fires a screen_view on mount and a dwell-time event on unmount for a surface.
export function useScreenView(surface: string): void {
  const enteredAt = useRef<number>(0)
  useEffect(() => {
    enteredAt.current = Date.now()
    track('screen_view', undefined, surface)
    return () => {
      const dwellMs = Date.now() - enteredAt.current
      track('screen_dwell', { dwell_ms: dwellMs }, surface)
    }
  }, [surface])
}
