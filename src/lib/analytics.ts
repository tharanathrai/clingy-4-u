import { supabase } from './supabase.ts'

// Anonymous, opt-out behavior analytics. No PII, no free text — enum/number props only.
// All work is best-effort and wrapped so tracking can never throw into app code.

export const APP_VERSION = '0.1.0'

const CONSENT_KEY = 'analytics_consent'
const INSTALL_ID_KEY = 'analytics_install_id'
const FLUSH_INTERVAL_MS = 15_000
const MAX_BUFFER = 50

export type AnalyticsProps = Record<string, number | boolean | string>

export interface TrackedEvent {
  event_name: string
  session_id: string
  surface?: string
  props?: AnalyticsProps
  platform: string
  app_version: string
}

// Provider seam: SupabaseSink ships now; PostHogSink is a stub for later. Call sites
// never change when a provider is added.
export interface AnalyticsSink {
  capture(event: TrackedEvent): void
  flush(): Promise<void>
}

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false
  // Respect Do Not Track as a hard opt-out.
  const dnt =
    (navigator as Navigator & { doNotTrack?: string }).doNotTrack ??
    (window as Window & { doNotTrack?: string }).doNotTrack
  if (dnt === '1' || dnt === 'yes') return false
  // Opt-out model: tracking is on unless explicitly disabled.
  return window.localStorage.getItem(CONSENT_KEY) !== 'false'
}

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'web'
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() ?? 'web'
}

function getInstallId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = window.localStorage.getItem(INSTALL_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(INSTALL_ID_KEY, id)
  }
  return id
}

// Posts batches to the track-events edge function. Auth is attached automatically by
// supabase-js when a session exists; install_id covers the pre-auth funnel.
class SupabaseSink implements AnalyticsSink {
  private buffer: TrackedEvent[] = []

  capture(event: TrackedEvent): void {
    this.buffer.push(event)
    if (this.buffer.length >= MAX_BUFFER) {
      void this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const events = this.buffer
    this.buffer = []
    try {
      await supabase.functions.invoke('track-events', {
        body: { events, install_id: getInstallId() },
      })
    } catch {
      // Drop on failure — analytics must never disrupt the app or retry-storm.
    }
  }
}

// Stub for future PostHog forwarding. Intentionally inert.
export class PostHogSink implements AnalyticsSink {
  capture(): void {}
  async flush(): Promise<void> {}
}

const sink: AnalyticsSink = new SupabaseSink()

// One session id per app-open.
const sessionId =
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'no-session'

let timerStarted = false
function ensureFlushLifecycle(): void {
  if (timerStarted || typeof window === 'undefined') return
  timerStarted = true
  window.setInterval(() => void sink.flush(), FLUSH_INTERVAL_MS)
  // Flush when the app is backgrounded / closed (covers mobile webview pauses).
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void sink.flush()
  })
  window.addEventListener('pagehide', () => void sink.flush())
}

export function track(eventName: string, props?: AnalyticsProps, surface?: string): void {
  try {
    if (!hasConsent()) return
    ensureFlushLifecycle()
    sink.capture({
      event_name: eventName,
      session_id: sessionId,
      surface,
      props,
      platform: detectPlatform(),
      app_version: APP_VERSION,
    })
  } catch {
    // never throw into UI
  }
}

export function setAnalyticsConsent(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false')
}

export function getAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(CONSENT_KEY) !== 'false'
}

// Lightweight rage-tap detector: ≥3 taps on the same target within 600ms.
const rageState = { target: '', count: 0, first: 0 }
export function registerTap(target: string): void {
  const now = Date.now()
  if (rageState.target === target && now - rageState.first <= 600) {
    rageState.count += 1
    if (rageState.count >= 3) {
      track('rage_tap', { count: rageState.count }, target)
      rageState.count = 0
      rageState.first = now
    }
  } else {
    rageState.target = target
    rageState.count = 1
    rageState.first = now
  }
}
