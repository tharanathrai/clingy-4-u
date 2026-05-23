/**
 * Tests for src/lib/validateQrToken.ts
 *
 * Verifies mapValidateQrIssue correctly classifies each error code/message.
 * validateQrTokenRequest is a network call; not unit-tested here.
 */

import { describe, it, expect } from 'vitest'
import { mapValidateQrIssue } from '../lib/validateQrToken.ts'

describe('mapValidateQrIssue', () => {
  it('maps error_code "expired" to expired type', () => {
    const issue = mapValidateQrIssue({ error_code: 'expired' })
    expect(issue.type).toBe('expired')
    expect(issue.message).toMatch(/expired/i)
  })

  it('maps "expired" in error message text', () => {
    const issue = mapValidateQrIssue({ error: 'Token expired' })
    expect(issue.type).toBe('expired')
  })

  it('maps error_code "already_connected"', () => {
    const issue = mapValidateQrIssue({
      error_code: 'already_connected',
      user: { display_name: 'Sam', username: 'sam', avatar_url: null },
    })
    expect(issue.type).toBe('already_connected')
    expect(issue.message).toContain('Sam')
    expect(issue.connectedUser?.username).toBe('sam')
  })

  it('falls back to generic name when no user provided for already_connected', () => {
    const issue = mapValidateQrIssue({ error: 'already connected with this user' })
    expect(issue.type).toBe('already_connected')
    expect(issue.message).toContain('this person')
  })

  it('maps error_code "request_pending"', () => {
    const issue = mapValidateQrIssue({ error_code: 'request_pending' })
    expect(issue.type).toBe('request_pending')
  })

  it('maps "pending request" in error message', () => {
    const issue = mapValidateQrIssue({ error: 'there is a pending request' })
    expect(issue.type).toBe('request_pending')
  })

  it('maps error_code "own_qr"', () => {
    const issue = mapValidateQrIssue({ error_code: 'own_qr' })
    expect(issue.type).toBe('own')
  })

  it('maps "your own" in error message', () => {
    const issue = mapValidateQrIssue({ error: 'This is your own QR code' })
    expect(issue.type).toBe('own')
  })

  it('maps error_code "invalid_token"', () => {
    const issue = mapValidateQrIssue({ error_code: 'invalid_token' })
    expect(issue.type).toBe('invalid_token')
    expect(issue.message).toMatch(/not a clingy connection code/i)
  })

  it('maps "invalid token" in error message', () => {
    const issue = mapValidateQrIssue({ error: 'Invalid token.' })
    expect(issue.type).toBe('invalid_token')
  })

  it('maps unknown errors to generic', () => {
    const issue = mapValidateQrIssue({ error: 'network timeout' })
    expect(issue.type).toBe('generic')
    expect(issue.message).toMatch(/try again/i)
  })

  it('handles empty error payload gracefully', () => {
    const issue = mapValidateQrIssue({})
    expect(issue.type).toBe('generic')
  })
})
