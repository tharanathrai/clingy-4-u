/**
 * Tests for src/hooks/useProfileReady.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const { mockMaybeSingle } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
}))

vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  },
}))

import { useProfileReady, markProfileReady } from '../hooks/useProfileReady.ts'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useProfileReady', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('returns null and not loading when userId is null', () => {
    const { result } = renderHook(() => useProfileReady(null), {
      wrapper: makeWrapper(queryClient),
    })
    expect(result.current.profileReady).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('returns true when the user row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'user1' }, error: null })

    const { result } = renderHook(() => useProfileReady('user1'), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.profileReady).toBe(true)
  })

  it('returns false when no user row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useProfileReady('user2'), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.profileReady).toBe(false)
  })

  it('returns false on Supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network error' } })

    const { result } = renderHook(() => useProfileReady('user3'), {
      wrapper: makeWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.profileReady).toBe(false)
  })

  it('markProfileReady immediately sets the cache to true', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    markProfileReady('user4', qc)

    const { result } = renderHook(() => useProfileReady('user4'), {
      wrapper: makeWrapper(qc),
    })

    // Cache hit — no async needed
    expect(result.current.profileReady).toBe(true)
  })
})
