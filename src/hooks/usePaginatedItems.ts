import { useEffect, useMemo, useState } from 'react'

interface UsePaginatedItemsResult<T> {
  visibleItems: T[]
  hasMore: boolean
  loadMore: () => void
}

export function usePaginatedItems<T>(
  items: T[],
  pageSize = 6,
  storageKey?: string,
): UsePaginatedItemsResult<T> {
  const resetFromReload = isReloadNavigation()

  const [visibleCount, setVisibleCount] = useState(() => {
    if (!storageKey) {
      return pageSize
    }
    if (resetFromReload) {
      window.sessionStorage.removeItem(storageKey)
      return pageSize
    }
    const saved = window.sessionStorage.getItem(storageKey)
    const parsed = saved ? Number(saved) : Number.NaN
    if (!Number.isFinite(parsed) || parsed < pageSize) {
      return pageSize
    }
    return parsed
  })

  useEffect(() => {
    if (!storageKey) {
      return
    }
    window.sessionStorage.setItem(storageKey, String(visibleCount))
  }, [storageKey, visibleCount])

  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount)
  }, [items, visibleCount])

  const hasMore = visibleCount < items.length

  const loadMore = () => {
    setVisibleCount((current) => current + pageSize)
  }

  return {
    visibleItems,
    hasMore,
    loadMore,
  }
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
