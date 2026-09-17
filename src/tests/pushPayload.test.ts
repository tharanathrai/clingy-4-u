/**
 * Tests for supabase/functions/_shared/pushPayload.ts
 *
 * Every pushed notification type produces a body, the deep link is always
 * /notifications, and the tag fits the Web Push Topic header.
 */

import { describe, it, expect } from 'vitest'
import {
  PUSH_TITLE,
  PUSH_URL,
  buildPushPayload,
  buildPushTag,
} from '../../supabase/functions/_shared/pushPayload.ts'

// post_reaction is skipped by the DB trigger; everything else is pushed.
const PUSHED_TYPES = [
  'invite_received',
  'invite_accepted',
  'invite_rejected',
  'plan_turned_down',
  'member_declined',
  'plan_expiring_soon',
  'plan_expired',
  'bridge_formed',
  'post_comment',
  'connection_request',
  'connection_accepted',
  'plan_edit_proposed',
  'plan_edit_accepted',
  'plan_edit_declined',
  'confirmation_started',
]

const REFERENCE_ID = '0f8a1c2e-9d3b-4a5c-8e7f-123456789abc'

describe('buildPushPayload', () => {
  it.each(PUSHED_TYPES)('builds a payload for %s', (type) => {
    const payload = buildPushPayload({
      id: 'n1',
      type,
      reference_id: REFERENCE_ID,
      actor_name: 'Priya',
    })
    expect(payload.title).toBe(PUSH_TITLE)
    expect(payload.body.length).toBeGreaterThan(0)
    expect(payload.url).toBe(PUSH_URL)
    expect(payload.tag.length).toBeLessThanOrEqual(32)
    expect(payload.tag).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('uses the actor name in the copy', () => {
    const payload = buildPushPayload({
      id: 'n1',
      type: 'invite_received',
      reference_id: REFERENCE_ID,
      actor_name: 'Priya',
    })
    expect(payload.body).toBe('Priya wants to make a plan with you')
  })

  it('falls back to "Someone" when actor_name is missing', () => {
    const payload = buildPushPayload({
      id: 'n1',
      type: 'connection_request',
      reference_id: REFERENCE_ID,
      actor_name: null,
    })
    expect(payload.body).toBe('Someone wants to connect')
  })

  it('falls back to generic copy for an unknown type', () => {
    const payload = buildPushPayload({
      id: 'n1',
      type: 'something_new',
      reference_id: REFERENCE_ID,
    })
    expect(payload.body).toBe('You have a new notification')
  })
})

describe('buildPushTag', () => {
  it('strips characters outside the URL-safe set and caps at 32', () => {
    const tag = buildPushTag('plan_edit_proposed', REFERENCE_ID)
    expect(tag).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(tag.length).toBe(32)
  })

  it('is stable for the same type + reference', () => {
    expect(buildPushTag('bridge_formed', REFERENCE_ID)).toBe(
      buildPushTag('bridge_formed', REFERENCE_ID),
    )
  })

  it('differs across references for the same type', () => {
    expect(buildPushTag('bridge_formed', REFERENCE_ID)).not.toBe(
      buildPushTag('bridge_formed', 'ffffffff-0000-4000-8000-000000000000'),
    )
  })
})
