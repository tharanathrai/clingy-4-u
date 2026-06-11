import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { debouncedInvalidateQueries, flushDebouncedInvalidations } from '../lib/debouncedInvalidate.ts'
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
