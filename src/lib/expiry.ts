import { differenceInCalendarDays, format, formatDistance, parseISO } from 'date-fns'

export type ExpiryState = 'expired' | 'ending_today' | 'soon' | 'later'

export interface ExpiryDescription {
  /** Short copy for cards and status lines, e.g. "by Dec 31", "2 days left", "Expired". */
  label: string
  state: ExpiryState
  /** Remaining share of the active window, 0–100. */
  progress: number
}

export interface ExpiryInput {
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
  expires_at: string
  planned_date: string | null
  accepted_at: string | null
  created_at: string
}

const SOON_DAYS = 7

/**
 * Describes when a piece runs out. Guards against past `expires_at` — the
 * nightly cron flips status up to 24h later, so the client must never show a
 * past date as time "left". Planned pieces show the date the user chose.
 */
export function describeExpiry(piece: ExpiryInput, now: Date = new Date()): ExpiryDescription {
  const expiresAt = new Date(piece.expires_at)
  const progress = remainingProgress(piece, expiresAt, now)

  if (piece.status === 'expired' || expiresAt.getTime() <= now.getTime()) {
    return {
      label: piece.status === 'placeholder' ? 'Invite expired' : 'Expired',
      state: 'expired',
      progress: 0,
    }
  }

  if (piece.status === 'placeholder') {
    return {
      label: `${formatDistance(expiresAt, now)} to accept`,
      state: daysState(differenceInCalendarDays(expiresAt, now)),
      progress,
    }
  }

  if (piece.planned_date) {
    const planned = parseISO(piece.planned_date)
    const daysUntil = differenceInCalendarDays(planned, now)
    const state = daysState(daysUntil)
    const base = `by ${format(planned, 'MMM d')}`
    if (daysUntil <= 0) return { label: `${base} · today`, state, progress }
    if (daysUntil === 1) return { label: `${base} · tomorrow`, state, progress }
    if (daysUntil < SOON_DAYS) return { label: `${base} · ${daysUntil} days left`, state, progress }
    return { label: base, state, progress }
  }

  return {
    label: `${formatDistance(expiresAt, now)} left`,
    state: daysState(differenceInCalendarDays(expiresAt, now)),
    progress,
  }
}

function daysState(days: number): ExpiryState {
  if (days <= 0) return 'ending_today'
  if (days < SOON_DAYS) return 'soon'
  return 'later'
}

function remainingProgress(piece: ExpiryInput, expiresAt: Date, now: Date): number {
  const start = new Date(piece.accepted_at ?? piece.created_at).getTime()
  const end = expiresAt.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const remaining = Math.max(0, end - now.getTime())
  return Math.max(0, Math.min(100, Math.round((remaining / (end - start)) * 100)))
}
