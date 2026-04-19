import { useEffect, useRef } from 'react'

export function useScrollRestore(storageKey: string, restoreTrigger?: unknown) {
  const lastScrollYRef = useRef(0)
  const shouldResetOnMountRef = useRef(isReloadNavigation())

  useEffect(() => {
    if (shouldResetOnMountRef.current) {
      window.sessionStorage.removeItem(storageKey)
      lastScrollYRef.current = 0
      window.scrollTo(0, 0)
      return
    }

    const restore = () => {
      const saved = window.sessionStorage.getItem(storageKey)
      const nextY = saved ? Number(saved) : 0
      if (!Number.isFinite(nextY) || nextY <= 0) {
        return
      }

      const maxScrollableY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      )
      const targetY = Math.min(nextY, maxScrollableY)
      lastScrollYRef.current = targetY
      window.scrollTo(0, targetY)
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        restore()
      })
    })
  }, [storageKey, restoreTrigger])

  useEffect(() => {
    if (shouldResetOnMountRef.current) {
      return
    }

    const onScroll = () => {
      lastScrollYRef.current = window.scrollY
      window.sessionStorage.setItem(storageKey, String(lastScrollYRef.current))
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.sessionStorage.setItem(storageKey, String(lastScrollYRef.current))
    }
  }, [storageKey])
}

function isReloadNavigation(): boolean {
  const navEntries = window.performance.getEntriesByType('navigation')
  const navEntry = navEntries[0] as PerformanceNavigationTiming | undefined
  if (navEntry?.type === 'reload') {
    return true
  }

  const legacyNavigation = (
    window.performance as Performance & { navigation?: { type?: number } }
  ).navigation
  return legacyNavigation?.type === 1
}
