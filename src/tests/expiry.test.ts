/**
 * Tests for src/lib/expiry.ts
 *
 * Regression: pieces past expires_at rendered "3 months left" because
 * formatDistanceToNow is unsigned. Planned pieces should show their date.
 */

import { describe, it, expect } from 'vitest'
import { describeExpiry, type ExpiryInput } from '../lib/expiry.ts'

// Fixed clock: 2026-09-17 12:00 UTC
const NOW = new Date('2026-09-17T12:00:00Z')

function piece(overrides: Partial<ExpiryInput> = {}): ExpiryInput {
  return {
    status: 'active',
    created_at: '2026-06-20T10:00:00Z',
    accepted_at: '2026-06-20T12:00:00Z',
    planned_date: null,
    expires_at: '2027-06-20T12:00:00Z',
    ...overrides,
  }
}

describe('describeExpiry', () => {
  it('reports expired for an active piece whose expires_at is in the past', () => {
    const result = describeExpiry(
      piece({ planned_date: '2026-06-21', expires_at: '2026-06-22T00:00:00Z' }),
      NOW,
    )
    expect(result).toEqual({ label: 'Expired', state: 'expired', progress: 0 })
    expect(result.label).not.toMatch(/left/)
  })

  it('reports invite expired for a stale placeholder', () => {
    const result = describeExpiry(
      piece({ status: 'placeholder', accepted_at: null, expires_at: '2026-06-22T10:00:00Z' }),
      NOW,
    )
    expect(result.label).toBe('Invite expired')
    expect(result.state).toBe('expired')
  })

  it('treats status expired as expired even if expires_at is somehow ahead', () => {
    const result = describeExpiry(piece({ status: 'expired' }), NOW)
    expect(result.state).toBe('expired')
  })

  it('shows the planned date for a planned piece more than a week out', () => {
    const result = describeExpiry(
      piece({ planned_date: '2026-12-31', expires_at: '2027-01-01T00:00:00Z' }),
      NOW,
    )
    expect(result.label).toBe('by Dec 31')
    expect(result.state).toBe('later')
  })

  it('appends days left when a planned piece is within a week', () => {
    const result = describeExpiry(
      piece({ planned_date: '2026-09-21', expires_at: '2026-09-22T00:00:00Z' }),
      NOW,
    )
    expect(result.label).toBe('by Sep 21 · 4 days left')
    expect(result.state).toBe('soon')
  })

  it('says tomorrow and today at the edges', () => {
    expect(
      describeExpiry(piece({ planned_date: '2026-09-18', expires_at: '2026-09-19T00:00:00Z' }), NOW)
        .label,
    ).toBe('by Sep 18 · tomorrow')
    const today = describeExpiry(
      piece({ planned_date: '2026-09-17', expires_at: '2026-09-18T00:00:00Z' }),
      NOW,
    )
    expect(today.label).toBe('by Sep 17 · today')
    expect(today.state).toBe('ending_today')
  })

  it('falls back to a distance for unplanned pieces', () => {
    const result = describeExpiry(piece(), NOW)
    expect(result.label).toBe('9 months left')
    expect(result.state).toBe('later')
  })

  it('shows time to accept for a live placeholder', () => {
    const result = describeExpiry(
      piece({ status: 'placeholder', accepted_at: null, expires_at: '2026-09-19T12:00:00Z' }),
      NOW,
    )
    expect(result.label).toBe('2 days to accept')
    expect(result.state).toBe('soon')
  })

  it('measures progress from accepted_at, falling back to created_at', () => {
    // accepted 2026-09-07, expires 2026-09-27 → 20-day window, 10 days left = 50%
    const withAccepted = describeExpiry(
      piece({
        created_at: '2026-09-01T12:00:00Z',
        accepted_at: '2026-09-07T12:00:00Z',
        expires_at: '2026-09-27T12:00:00Z',
      }),
      NOW,
    )
    expect(withAccepted.progress).toBe(50)

    // no accepted_at: created 2026-09-07 → same 50%
    const withoutAccepted = describeExpiry(
      piece({
        created_at: '2026-09-07T12:00:00Z',
        accepted_at: null,
        expires_at: '2026-09-27T12:00:00Z',
      }),
      NOW,
    )
    expect(withoutAccepted.progress).toBe(50)
  })
})
