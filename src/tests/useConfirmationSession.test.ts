/**
 * Tests for useConfirmationSession onBridgeFormed once-only semantics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const { mockSubscribe, channelBindings } = vi.hoisted(() => {
  const bindings: Array<{ event: string; callback: (payload: unknown) => void }> = []
  const mockSubscribe = vi.fn((_prefix: string, nextBindings: typeof bindings) => {
    bindings.length = 0
    bindings.push(...nextBindings)
    return vi.fn()
  })
  return { mockSubscribe, channelBindings: bindings }
})

vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'session-1',
                    gum_piece_id: 'piece-1',
                    otp_code: '123456',
                    initiator_id: 'user-a',
                    initiator_confirmed: true,
                    responder_confirmed: false,
                    expires_at: new Date(Date.now() + 60_000).toISOString(),
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock('../lib/realtime.ts', () => ({
  subscribePostgresChannel: mockSubscribe,
}))

import { useConfirmationSession } from '../hooks/useConfirmationSession.ts'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useConfirmationSession', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    channelBindings.length = 0
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('fires onBridgeFormed exactly once per session DELETE', async () => {
    const onBridgeFormed = vi.fn()

    const { result } = renderHook(
      () =>
        useConfirmationSession({
          gumPieceId: 'piece-1',
          onBridgeFormed,
        }),
      { wrapper: makeWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.session).not.toBeNull())
    await waitFor(() => expect(channelBindings.length).toBeGreaterThan(0))

    const deleteBinding = channelBindings.find((binding) => binding.event === 'DELETE')
    expect(deleteBinding).toBeDefined()

    act(() => {
      deleteBinding!.callback({})
      deleteBinding!.callback({})
    })

    expect(onBridgeFormed).toHaveBeenCalledTimes(1)
  })
})
