/**
 * Tests for src/lib/realtime.ts
 *
 * Verifies the core guarantee: calling subscribePostgresChannel multiple times
 * (as React StrictMode does) never throws "cannot add callbacks after subscribe()"
 * because each invocation gets a unique channel name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these are available before vi.mock hoists the factory
const { mockChannel, mockSupabaseChannel, mockRemoveChannel } = vi.hoisted(() => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    mockChannel: channel,
    mockSupabaseChannel: vi.fn().mockReturnValue(channel),
    mockRemoveChannel: vi.fn(),
  }
})

vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    channel: mockSupabaseChannel,
    removeChannel: mockRemoveChannel,
  },
}))

import { subscribePostgresChannel } from '../lib/realtime.ts'

describe('subscribePostgresChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannel.on.mockReturnValue(mockChannel)
    mockSupabaseChannel.mockReturnValue(mockChannel)
  })

  it('calls supabase.channel with a name that includes the given prefix', () => {
    subscribePostgresChannel('gum-pieces-rt-user1', [
      { event: '*', table: 'gum_pieces', callback: vi.fn() },
    ])

    const channelName: string = mockSupabaseChannel.mock.calls[0][0] as string
    expect(channelName).toMatch(/^gum-pieces-rt-user1-/)
  })

  it('generates a unique channel name for each invocation (StrictMode safety)', () => {
    subscribePostgresChannel('test-prefix', [
      { event: '*', table: 'anything', callback: vi.fn() },
    ])
    subscribePostgresChannel('test-prefix', [
      { event: '*', table: 'anything', callback: vi.fn() },
    ])

    const name1: string = mockSupabaseChannel.mock.calls[0][0] as string
    const name2: string = mockSupabaseChannel.mock.calls[1][0] as string
    expect(name1).not.toBe(name2)
  })

  it('registers all bindings before calling subscribe()', () => {
    subscribePostgresChannel('multi', [
      { event: 'INSERT', table: 'table_a', callback: vi.fn() },
      { event: 'UPDATE', table: 'table_b', callback: vi.fn() },
    ])

    // .on() called twice, then .subscribe() once
    expect(mockChannel.on).toHaveBeenCalledTimes(2)
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1)

    const onOrder = mockChannel.on.mock.invocationCallOrder[0]
    const subscribeOrder = mockChannel.subscribe.mock.invocationCallOrder[0]
    expect(onOrder).toBeLessThan(subscribeOrder)
  })

  it('passes the correct event/table/filter to .on()', () => {
    subscribePostgresChannel('filtered', [
      { event: 'DELETE', table: 'notifications', filter: 'user_id=eq.abc', callback: vi.fn() },
    ])

    const onArgs = mockChannel.on.mock.calls[0]
    expect(onArgs[0]).toBe('postgres_changes')
    expect(onArgs[1]).toMatchObject({
      event: 'DELETE',
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.abc',
    })
  })

  it('returns a cleanup function that calls supabase.removeChannel', () => {
    const cleanup = subscribePostgresChannel('cleanup-test', [
      { event: '*', table: 'any', callback: vi.fn() },
    ])
    cleanup()
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('omits filter from .on() args when not provided', () => {
    subscribePostgresChannel('no-filter', [
      { event: '*', table: 'gum_pieces', callback: vi.fn() },
    ])

    const onArgs = mockChannel.on.mock.calls[0]
    expect(onArgs[1]).not.toHaveProperty('filter')
  })
})
