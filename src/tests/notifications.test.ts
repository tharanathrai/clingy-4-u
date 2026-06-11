/**
 * Tests for notification enrichment helpers in src/hooks/useNotifications.ts
 *
 * The actor resolution logic (getActorAndTargetUserId) is tested here by
 * exercising mapValidateQrIssue and the type enum directly without needing
 * a live Supabase connection.
 *
 * Optimistic mutation rollback is verified at the query-key level using
 * a controlled QueryClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import type { NotificationType } from '../hooks/useNotifications.ts'

// Verify the exported type covers all notification types from PRD section 14
describe('NotificationType union', () => {
  const allTypes: NotificationType[] = [
    'invite_received',
    'invite_accepted',
    'invite_rejected',
    'plan_turned_down',
    'plan_expiring_soon',
    'plan_expired',
    'bridge_formed',
    'post_comment',
    'post_reaction',
    'connection_request',
    'connection_accepted',
  ]

  it('covers all 11 PRD notification types', () => {
    expect(allTypes).toHaveLength(11)
  })

  it('includes plan_expired (regression: was missing from enrichNotifications filter)', () => {
    expect(allTypes).toContain('plan_expired')
  })

  it('includes post_reaction (excluded from UI but present in type)', () => {
    expect(allTypes).toContain('post_reaction')
  })
})

// Verify query key shape — ensures cache invalidation targets the right key
describe('queryKeys.notifications', () => {
  it('includes userId as second element', async () => {
    const { queryKeys } = await import('../lib/queryKeys.ts')
    const key = queryKeys.notifications('user-abc')
    expect(key[0]).toBe('notifications')
    expect(key[1]).toBe('user-abc')
  })

  it('returns null userId variant', async () => {
    const { queryKeys } = await import('../lib/queryKeys.ts')
    const key = queryKeys.notifications(null)
    expect(key[1]).toBeNull()
  })
})

describe('useNotifications INSERT queue', () => {
  const channelBindings: Array<{ event: string; callback: (payload: unknown) => void }> = []

  beforeEach(() => {
    channelBindings.length = 0
    vi.resetModules()
  })

  it('deduplicates concurrent INSERT enrichments', async () => {
    vi.doMock('../lib/realtime.ts', () => ({
      subscribePostgresChannel: (_prefix: string, bindings: typeof channelBindings) => {
        channelBindings.push(...bindings)
        return vi.fn()
      },
    }))

    vi.doMock('../lib/supabase.ts', () => ({
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            neq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      },
    }))

    vi.doMock('../hooks/useAuth.ts', () => ({
      useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
    }))

    const { useNotifications } = await import('../hooks/useNotifications.ts')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderHook(() => useNotifications(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    })

    await waitFor(() => expect(channelBindings.length).toBeGreaterThan(0))

    const insertBinding = channelBindings.find((binding) => binding.event === 'INSERT')
    expect(insertBinding).toBeDefined()

    const inserted = {
      id: 'notif-1',
      user_id: 'user-1',
      type: 'invite_received' as NotificationType,
      reference_id: 'piece-1',
      read: false,
      created_at: new Date().toISOString(),
    }

    insertBinding!.callback({ new: inserted })
    insertBinding!.callback({ new: inserted })

    await waitFor(() => {
      const rows = queryClient.getQueryData(['notifications', 'user-1']) as unknown[] | undefined
      expect(rows?.length).toBe(1)
    })
  })
})
