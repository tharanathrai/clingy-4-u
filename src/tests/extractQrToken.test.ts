/**
 * Tests for src/lib/extractQrToken.ts
 */

import { describe, expect, it } from 'vitest'
import { extractQrToken } from '../lib/extractQrToken.ts'

describe('extractQrToken', () => {
  it('extracts token from a connect URL', () => {
    expect(
      extractQrToken('https://example.com/connect?token=abc123'),
    ).toBe('abc123')
  })

  it('extracts token when URL has other query params', () => {
    expect(
      extractQrToken('https://example.com/connect?ref=share&token=xyz789'),
    ).toBe('xyz789')
  })

  it('returns raw string when value is not a URL', () => {
    expect(extractQrToken('plain-token-value')).toBe('plain-token-value')
  })

  it('trims whitespace from raw token values', () => {
    expect(extractQrToken('  raw-token  ')).toBe('raw-token')
  })

  it('returns null for empty string', () => {
    expect(extractQrToken('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(extractQrToken('   ')).toBeNull()
  })

  it('returns null when connect URL has no token param', () => {
    expect(extractQrToken('https://example.com/connect')).toBeNull()
  })
})
