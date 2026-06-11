import type { QueryClient, QueryKey } from '@tanstack/react-query'

const DEBOUNCE_MS = 300
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

function keyToString(queryKey: QueryKey): string {
  return JSON.stringify(queryKey)
}

export function debouncedInvalidateQueries(
  queryClient: QueryClient,
  queryKey: QueryKey,
  delayMs = DEBOUNCE_MS,
): void {
  const serialized = keyToString(queryKey)
  const existing = pendingTimers.get(serialized)
  if (existing) {
    clearTimeout(existing)
  }

  pendingTimers.set(
    serialized,
    setTimeout(() => {
      pendingTimers.delete(serialized)
      void queryClient.invalidateQueries({ queryKey })
    }, delayMs),
  )
}

/** Test helper — flush all pending debounced invalidations immediately. */
export function flushDebouncedInvalidations(queryClient: QueryClient): void {
  for (const [serialized, timer] of pendingTimers) {
    clearTimeout(timer)
    pendingTimers.delete(serialized)
    void queryClient.invalidateQueries({ queryKey: JSON.parse(serialized) as QueryKey })
  }
}
