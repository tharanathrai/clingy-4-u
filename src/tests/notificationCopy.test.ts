/**
 * Tests for supabase/functions/_shared/notificationCopy.ts
 *
 * Guards the wording shared by the in-app list and Web Push. Moved out of
 * NotificationItem.tsx in spec 022.
 */

import { describe, it, expect } from 'vitest'
import { getNotificationCopy } from '../../supabase/functions/_shared/notificationCopy.ts'

describe('getNotificationCopy', () => {
  it.each([
    ['invite_received', 'Priya wants to make a plan with you'],
    ['invite_accepted', 'Priya accepted your plan'],
    ['invite_rejected', 'Priya passed on your plan'],
    ['plan_turned_down', 'Priya turned down a plan'],
    ['member_declined', 'Priya passed on your plan'],
    ['plan_expiring_soon', 'A plan is expiring soon'],
    ['bridge_formed', 'You formed a bridge with Priya'],
    ['connection_request', 'Priya wants to connect'],
    ['connection_accepted', 'Priya accepted your connection request'],
    ['post_reaction', 'Someone reacted to your post'],
    ['post_comment', 'Priya commented on your post'],
    ['plan_edit_proposed', 'Priya proposed a change to a plan'],
    ['plan_edit_accepted', 'Plan changes were accepted'],
    ['plan_edit_declined', 'Priya declined your proposed change'],
    ['confirmation_started', 'Priya is ready to confirm — tap to complete the plan'],
  ])('%s', (type, expected) => {
    expect(getNotificationCopy(type, 'Priya')).toBe(expected)
  })

  it('plan_expired names the other member on a two-person plan', () => {
    expect(getNotificationCopy('plan_expired', 'Priya', 'Priya')).toBe('Your plan with Priya expired')
  })

  it('plan_expired reads as a group plan when no actor_name is stored', () => {
    expect(getNotificationCopy('plan_expired', 'Unknown user', null)).toBe('Your group plan expired')
    expect(getNotificationCopy('plan_expired', 'Someone', undefined)).toBe('Your group plan expired')
  })

  it('falls back for unknown types', () => {
    expect(getNotificationCopy('nope', 'Priya')).toBe('You have a new notification')
  })
})
