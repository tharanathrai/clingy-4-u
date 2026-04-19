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
  const [visibleCount, setVisibleCount] = useState(() => {
    if (!storageKey) {
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
