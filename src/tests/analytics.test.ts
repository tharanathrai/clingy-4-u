import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('../lib/supabase.ts', () => ({
  supabase: { functions: { invoke: invokeMock } },
}))

import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  track,
} from '../lib/analytics.ts'

describe('analytics consent gate', () => {
  beforeEach(() => {
    invokeMock.mockClear()
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('defaults to consent on (opt-out model)', () => {
    expect(getAnalyticsConsent()).toBe(true)
  })

  it('persists an opt-out and reports it', () => {
    setAnalyticsConsent(false)
    expect(getAnalyticsConsent()).toBe(false)
    expect(window.localStorage.getItem('analytics_consent')).toBe('false')
  })

  it('never sends events when consent is off, even past the flush threshold', async () => {
    setAnalyticsConsent(false)
    for (let i = 0; i < 60; i++) {
      track('tap', { i }, 'test')
    }
    await Promise.resolve()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('does not throw and stays silent for an unrelated failure path', () => {
    setAnalyticsConsent(false)
    expect(() => track('screen_view', undefined, 'test')).not.toThrow()
  })

  it('buffers and flushes to the edge function when consent is on', async () => {
    setAnalyticsConsent(true)
    // Exceed MAX_BUFFER (50) to force an auto-flush.
    for (let i = 0; i < 55; i++) {
      track('tap', { i }, 'test')
    }
    await Promise.resolve()
    await Promise.resolve()
    expect(invokeMock).toHaveBeenCalled()
    const [fnName, payload] = invokeMock.mock.calls[0]
    expect(fnName).toBe('track-events')
    expect(Array.isArray(payload.body.events)).toBe(true)
    expect(typeof payload.body.install_id).toBe('string')
  })
})
