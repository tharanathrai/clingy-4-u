// Shared analytics helpers for the track-events edge function.
// Keep this provider-agnostic so a PostHog forwarder can reuse the same allowlist + sanitizer.

// Allowlisted event names. Anything outside this set is dropped server-side.
export const ALLOWED_EVENTS = new Set<string>([
  'screen_view',
  'screen_dwell',
  'tap',
  'rage_tap',
  'scroll_depth',
  'auth_start',
  'onboarding_step',
  'piece_create_start',
  'piece_create_submit',
  'confirm_enter',
  'confirm_abandon',
  'confirm_success',
  'qr_scan_attempt',
  'qr_scan_success',
  'qr_scan_failure',
  'feed_dwell',
])

export const ALLOWED_PLATFORMS = new Set<string>(['web', 'ios', 'android'])

const MAX_PROP_STRING = 64
const MAX_PROPS_KEYS = 20
const MAX_EVENTS_PER_BATCH = 100

export interface IncomingEvent {
  event_name?: string
  session_id?: string
  surface?: string
  props?: Record<string, unknown>
  platform?: string
  app_version?: string
}

export interface SanitizedEvent {
  event_name: string
  session_id: string
  surface: string | null
  props: Record<string, number | boolean | string>
  platform: string | null
  app_version: string | null
}

// Strip anything that is not a number/boolean, or a short enum-like string.
// This is the hard guarantee that no titles/names/free text reach the store.
function sanitizeProps(input: unknown): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {}
  if (!input || typeof input !== 'object') return out
  let count = 0
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PROPS_KEYS) break
    if (typeof key !== 'string' || key.length > 40) continue
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
      count++
    } else if (typeof value === 'boolean') {
      out[key] = value
      count++
    } else if (typeof value === 'string' && value.length <= MAX_PROP_STRING) {
      // Only keep short strings (enum-like). Reject anything that looks like a sentence.
      if (!/\s{2,}/.test(value) && value.length <= MAX_PROP_STRING) {
        out[key] = value
        count++
      }
    }
    // everything else (objects, arrays, long strings, null) is dropped
  }
  return out
}

// Validate + sanitize a raw batch. Returns only the events that pass.
export function sanitizeBatch(rawEvents: unknown): SanitizedEvent[] {
  if (!Array.isArray(rawEvents)) return []
  const result: SanitizedEvent[] = []
  for (const raw of rawEvents.slice(0, MAX_EVENTS_PER_BATCH)) {
    const e = raw as IncomingEvent
    const name = typeof e.event_name === 'string' ? e.event_name.trim() : ''
    const session = typeof e.session_id === 'string' ? e.session_id.trim() : ''
    if (!ALLOWED_EVENTS.has(name)) continue
    if (!session || session.length > 64) continue

    const surface =
      typeof e.surface === 'string' && e.surface.length <= 64 ? e.surface : null
    const platform =
      typeof e.platform === 'string' && ALLOWED_PLATFORMS.has(e.platform)
        ? e.platform
        : null
    const appVersion =
      typeof e.app_version === 'string' && e.app_version.length <= 32
        ? e.app_version
        : null

    result.push({
      event_name: name,
      session_id: session,
      surface,
      props: sanitizeProps(e.props),
      platform,
      app_version: appVersion,
    })
  }
  return result
}

// Irreversible pseudonym: HMAC-SHA256(id, salt) -> hex. id may be a user_id or an
// anonymous install_id. Never store the raw id.
export async function pseudonymize(id: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(id))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
