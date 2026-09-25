import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { debouncedInvalidateQueries, flushDebouncedInvalidations } from '../lib/debouncedInvalidate.ts'
import { invalidateBridgeFormedFlow } from '../lib/invalidate.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import { queryKeys } from '../lib/queryKeys.ts'

describe('isInitialQueryLoading', () => {
  it('returns true when auth is loading and userId is unknown', () => {
    expect(isInitialQueryLoading(true, null, false)).toBe(true)
  })

  it('returns false when cached data exists and background refetch is pending', () => {
    expect(isInitialQueryLoading(false, 'user-1', false)).toBe(false)
  })

  it('returns true only on initial pending fetch when userId is known', () => {
    expect(isInitialQueryLoading(false, 'user-1', true)).toBe(true)
  })
})

describe('debouncedInvalidateQueries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces rapid invalidations into one call', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    debouncedInvalidateQueries(queryClient, queryKeys.feed('user-1'))
    debouncedInvalidateQueries(queryClient, queryKeys.feed('user-1'))
    debouncedInvalidateQueries(queryClient, queryKeys.feed('user-1'))

    expect(invalidateSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('flushDebouncedInvalidations runs pending invalidations immediately', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    debouncedInvalidateQueries(queryClient, queryKeys.gumPieces('user-2'))
    flushDebouncedInvalidations(queryClient)

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })
})

describe('invalidateBridgeFormedFlow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // Regression: the network graph is cached with staleTime Infinity and its
  // realtime listener only runs while Network is mounted, so a bridge formed
  // in the confirm flow stayed invisible until a full reload.
  it('marks the cached network graph stale while Network is unmounted', () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const userId = 'user-3'
    const keys = [
      queryKeys.networkGraph(userId),
      queryKeys.connectionsCount(userId),
      queryKeys.bridgesPair(userId, 'user-4'),
      queryKeys.feed(userId),
    ]
    for (const key of keys) queryClient.setQueryData(key, { cached: true })

    invalidateBridgeFormedFlow(userId, queryClient)
    vi.advanceTimersByTime(300)

    for (const key of keys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
  })

  it('does nothing without a user', () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateBridgeFormedFlow(null, queryClient)
    vi.advanceTimersByTime(300)

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
