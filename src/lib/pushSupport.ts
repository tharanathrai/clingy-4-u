// Pure helpers for Web Push support detection and key decoding. Kept free of
// browser globals so they are unit-testable (src/tests/pushSupport.test.ts).

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

export interface PushEnvironment {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  hasVapidKey: boolean
  isIos: boolean
  isStandalone: boolean
}

// iOS exposes PushManager only inside a Home-Screen-installed web app
// (16.4+). In a Safari tab we can still tell the user how to get there.
export function getPushSupport(env: PushEnvironment): PushSupport {
  if (!env.hasVapidKey || !env.hasServiceWorker || !env.hasNotification) {
    return 'unsupported'
  }
  if (env.hasPushManager) {
    return 'supported'
  }
  if (env.isIos && !env.isStandalone) {
    return 'needs-install'
  }
  return 'unsupported'
}

// `pushManager.subscribe` wants the raw P-256 public key as bytes; VAPID keys
// are distributed as URL-safe base64 without padding.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}
