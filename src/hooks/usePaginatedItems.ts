import { useEffect, useMemo, useState } from 'react'

interface UsePaginatedItemsResult<T> {
  visibleItems: T[]
  hasMore: boolean
  loadMore: () => void
}

export function usePaginatedItems<T>(
  items: T[],
  pageSize = 6,
): UsePaginatedItemsResult<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [items, pageSize])

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
