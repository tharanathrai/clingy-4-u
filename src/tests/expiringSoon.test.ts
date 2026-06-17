/**
 * Tests for supabase/functions/_shared/expiringSoon.ts
 *
 * Verifies 30-day window selection and idempotent notification row building.
 */

import { describe, it, expect } from 'vitest'
import {
  EXPIRING_SOON_WINDOW_DAYS,
  buildExpiringSoonNotificationRows,
  getExpiringSoonWindow,
  isActivePieceExpiringSoon,
  usersNeedingExpiringSoonEmail,
} from '../../supabase/functions/_shared/expiringSoon.ts'

describe('getExpiringSoonWindow', () => {
  it('returns now as start and 30 days ahead as end', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const { windowStartIso, windowEndIso } = getExpiringSoonWindow(now)
    expect(windowStartIso).toBe('2026-06-01T12:00:00.000Z')
    expect(windowEndIso).toBe('2026-07-01T12:00:00.000Z')
  })
})

describe('isActivePieceExpiringSoon', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  it('returns true when expiry is within 30 days but still in the future', () => {
    expect(isActivePieceExpiringSoon('2026-06-15T00:00:00.000Z', now)).toBe(true)
    expect(isActivePieceExpiringSoon('2026-07-01T12:00:00.000Z', now)).toBe(true)
  })

  it('returns false when expiry is already past', () => {
    expect(isActivePieceExpiringSoon('2026-05-31T23:59:59.000Z', now)).toBe(false)
    expect(isActivePieceExpiringSoon('2026-06-01T12:00:00.000Z', now)).toBe(false)
  })

  it('returns false when expiry is more than 30 days away', () => {
    expect(isActivePieceExpiringSoon('2026-07-02T00:00:00.000Z', now)).toBe(false)
  })

  it('uses EXPIRING_SOON_WINDOW_DAYS constant', () => {
    expect(EXPIRING_SOON_WINDOW_DAYS).toBe(30)
  })
})

describe('buildExpiringSoonNotificationRows', () => {
  const piece = {
    id: 'piece-1',
    member_ids: ['user-a', 'user-b'],
  }

  it('creates one notification per user per piece', () => {
    const rows = buildExpiringSoonNotificationRows([piece], [])
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          user_id: 'user-a',
          type: 'plan_expiring_soon',
          reference_id: 'piece-1',
          read: false,
        },
        {
          user_id: 'user-b',
          type: 'plan_expiring_soon',
          reference_id: 'piece-1',
          read: false,
        },
      ]),
    )
  })

  it('skips users who already have plan_expiring_soon for that piece', () => {
    const rows = buildExpiringSoonNotificationRows([piece], [
      {
        user_id: 'user-a',
        reference_id: 'piece-1',
        type: 'plan_expiring_soon',
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.user_id).toBe('user-b')
  })

  it('is idempotent when re-run with existing notifications for both users', () => {
    const rows = buildExpiringSoonNotificationRows([piece], [
      {
        user_id: 'user-a',
        reference_id: 'piece-1',
        type: 'plan_expiring_soon',
      },
      {
        user_id: 'user-b',
        reference_id: 'piece-1',
        type: 'plan_expiring_soon',
      },
    ])
    expect(rows).toHaveLength(0)
  })

  it('ignores unrelated notification types', () => {
    const rows = buildExpiringSoonNotificationRows([piece], [
      {
        user_id: 'user-a',
        reference_id: 'piece-1',
        type: 'plan_expired',
      },
    ])
    expect(rows).toHaveLength(2)
  })
})

describe('usersNeedingExpiringSoonEmail', () => {
  it('maps piece ids to user ids that received new notifications', () => {
    const map = usersNeedingExpiringSoonEmail([
      {
        user_id: 'user-a',
        type: 'plan_expiring_soon',
        reference_id: 'piece-1',
        read: false,
      },
      {
        user_id: 'user-b',
        type: 'plan_expiring_soon',
        reference_id: 'piece-1',
        read: false,
      },
    ])
    expect(map.get('piece-1')).toEqual(new Set(['user-a', 'user-b']))
  })
})
