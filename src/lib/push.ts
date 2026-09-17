import { supabase } from './supabase.ts'
import { getPushSupport, urlBase64ToUint8Array, type PushSupport } from './pushSupport.ts'

// Web Push client side (spec 022). Truth for "is push on" is the service
// worker's own subscription — never localStorage.
//
// Flow: Settings toggle (user gesture, required on iOS) -> Notification
// permission -> pushManager.subscribe with our VAPID public key -> upsert the
// endpoint + keys into push_subscriptions. The notifications INSERT trigger
// then fans out through the send-push edge function.

export type PushStatus = 'on' | 'off' | 'denied'

export class PushPermissionDeniedError extends Error {
  constructor() {
    super('Notification permission was not granted.')
    this.name = 'PushPermissionDeniedError'
  }
}

const vapidPublicKey: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function detectPushSupport(): PushSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported'
  }
  const ua = navigator.userAgent
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true

  return getPushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    hasVapidKey: Boolean(vapidPublicKey),
    isIos,
    isStandalone,
  })
}

const READY_TIMEOUT_MS = 8000

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // registerPwa skips registration in DEV; don't hang on `ready` there.
  if (import.meta.env.DEV) return null
  // `ready` also covers a registration still in flight (registerPwa registers
  // on window load). Bounded so a failed registration surfaces as an error
  // instead of a toggle stuck on "busy".
  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), READY_TIMEOUT_MS)
  })
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export async function getPushStatus(): Promise<PushStatus> {
  if (detectPushSupport() !== 'supported') return 'off'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await getRegistration()
  if (!registration) return 'off'
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

// Must be called from a click handler chain: iOS only shows the permission
// prompt in response to a user gesture.
export async function subscribeToPush(userId: string): Promise<void> {
  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushPermissionDeniedError()
  }

  const registration = await getRegistration()
  if (!registration) {
    throw new Error(
      'Service worker is not registered. Close and reopen Clingy, then try again.',
    )
  }

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing keys.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    // Don't leave a browser subscription the server doesn't know about.
    await subscription.unsubscribe()
    throw new Error(error.message)
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await getRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)
  if (error) {
    throw new Error(error.message)
  }
  await subscription.unsubscribe()
}
