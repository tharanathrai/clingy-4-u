/**
 * Tests for src/lib/pushSupport.ts
 *
 * Support matrix for the Settings push toggle and VAPID key decoding.
 */

import { describe, it, expect } from 'vitest'
import {
  getPushSupport,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from '../lib/pushSupport.ts'

const baseEnv: PushEnvironment = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  hasVapidKey: true,
  isIos: false,
  isStandalone: false,
}

describe('getPushSupport', () => {
  it('is supported when all APIs and the VAPID key are present', () => {
    expect(getPushSupport(baseEnv)).toBe('supported')
  })

  it('is needs-install in an iOS Safari tab (no PushManager, not standalone)', () => {
    expect(
      getPushSupport({ ...baseEnv, hasPushManager: false, isIos: true }),
    ).toBe('needs-install')
  })

  it('is supported in an installed iOS web app', () => {
    expect(
      getPushSupport({ ...baseEnv, isIos: true, isStandalone: true }),
    ).toBe('supported')
  })

  it('is unsupported on non-iOS browsers without PushManager', () => {
    expect(getPushSupport({ ...baseEnv, hasPushManager: false })).toBe('unsupported')
  })

  it('is unsupported when the VAPID public key is not configured', () => {
    expect(getPushSupport({ ...baseEnv, hasVapidKey: false })).toBe('unsupported')
  })

  it('is unsupported without a service worker or Notification API', () => {
    expect(getPushSupport({ ...baseEnv, hasServiceWorker: false })).toBe('unsupported')
    expect(getPushSupport({ ...baseEnv, hasNotification: false })).toBe('unsupported')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes a VAPID application server key to 65 raw bytes starting with 0x04', () => {
    // Uncompressed P-256 point: 0x04 followed by 64 bytes.
    const bytes = new Uint8Array(65)
    bytes[0] = 0x04
    for (let i = 1; i < bytes.length; i += 1) bytes[i] = (i * 37) % 256
    const base64Url = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const decoded = urlBase64ToUint8Array(base64Url)
    expect(decoded.length).toBe(65)
    expect(decoded[0]).toBe(0x04)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })

  it('handles inputs that need padding', () => {
    expect(Array.from(urlBase64ToUint8Array('YQ'))).toEqual([97])
    expect(Array.from(urlBase64ToUint8Array('YWI'))).toEqual([97, 98])
    expect(Array.from(urlBase64ToUint8Array('YWJj'))).toEqual([97, 98, 99])
  })
})
