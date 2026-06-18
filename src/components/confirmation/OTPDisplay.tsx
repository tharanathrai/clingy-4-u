import { Check } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { GumBlob } from '../gum/GumBlob.tsx'
import type { Bridge } from '../../types/index.ts'

export interface AcceptedMember {
  id: string
  name: string
}

interface OTPDisplayProps {
  code: string
  expiresAt: string
  confirmedMemberIds: string[]
  acceptedMembers: AcceptedMember[]
  currentUserId: string
  sessionId: string
  category: CategorySlug
  onBridgeFormed: (
    bridge: Bridge,
    draftPostId: string | null,
    draftPostBody: string | null,
  ) => void
  onSessionExpired: () => void
  onStartOver: () => Promise<void>
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const HOLD_DURATION_MS = 1500
const RING_RADIUS = 88
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function OTPDisplay({
  code,
  expiresAt,
  confirmedMemberIds,
  acceptedMembers,
  currentUserId,
  sessionId,
  category,
  onBridgeFormed,
  onSessionExpired,
  onStartOver,
}: OTPDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft(expiresAt))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStartOver, setShowStartOver] = useState(false)
  const [localConfirmed, setLocalConfirmed] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdStartRef = useRef<number | null>(null)

  useEffect(() => {
    setSecondsLeft(getSecondsLeft(expiresAt))
    setError(null)
    setShowStartOver(false)
    setLocalConfirmed(false)
  }, [expiresAt, sessionId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getSecondsLeft(expiresAt)
      setSecondsLeft(next)
      if (next <= 0) {
        setError('The window closed. Try again.')
        setShowStartOver(true)
      }
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [expiresAt])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    }
  }, [])

  const hasConfirmed = localConfirmed || confirmedMemberIds.includes(currentUserId)
  const isWarning = secondsLeft <= 60

  const handleConfirm = useCallback(async () => {
    if (hasConfirmed || submitting) return

    setSubmitting(true)
    setError(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
      return
    }

    const response = await fetch(`${functionsBaseUrl}/submit-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        otp_code: code,
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string
          bridge_formed?: boolean
          bridges?: Bridge[]
          draft_post_id?: string
          draft_post_body?: string
        }
      | null

    if (!response.ok) {
      if (payload?.error === 'session_expired') {
        setError('The window closed. Try again.')
        setShowStartOver(true)
        onSessionExpired()
      } else {
        setError('Something went wrong. Try again.')
      }
      setSubmitting(false)
      return
    }

    if (payload?.bridge_formed && payload.bridges && payload.bridges.length > 0) {
      const bridge = payload.bridges[0]
      onBridgeFormed(
        bridge,
        payload.draft_post_id ?? null,
        payload.draft_post_body ?? null,
      )
    } else {
      setLocalConfirmed(true)
    }

    setSubmitting(false)
  }, [hasConfirmed, submitting, sessionId, code, onBridgeFormed, onSessionExpired])

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
    holdStartRef.current = null
  }, [])

  const startHold = useCallback((e: React.PointerEvent) => {
    if (hasConfirmed || submitting || secondsLeft <= 0 || showStartOver) return
    e.currentTarget.setPointerCapture(e.pointerId)
    holdStartRef.current = Date.now()
    setIsHolding(true)
    setHoldProgress(0)

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - (holdStartRef.current ?? Date.now())
      const progress = Math.min(elapsed / HOLD_DURATION_MS, 1)
      setHoldProgress(progress)

      if (progress >= 1) {
        clearInterval(holdTimerRef.current!)
        holdTimerRef.current = null
        setIsHolding(false)
        void handleConfirm()
      }
    }, 30)
  }, [hasConfirmed, submitting, secondsLeft, showStartOver, handleConfirm])

  const memberLabel = acceptedMembers.length <= 2
    ? `Show this to ${acceptedMembers.filter(m => m.id !== currentUserId).map(m => m.name).join(' and ')} - everyone hold to confirm`
    : `Share this code — everyone hold to confirm`

  const gridCols = acceptedMembers.length <= 2 ? 'grid-cols-2' : acceptedMembers.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - holdProgress)

  return (
    <section className="relative flex flex-col rounded-lg bg-surface px-5 py-7 text-text shadow-card">
      <div className="otp-hero-glow" aria-hidden />
      <div className="relative z-10">
        <p className="text-center text-sm text-text-2">{memberLabel}</p>
        <p className="otp-code-text mt-4 text-center">{code}</p>
        <p
          className={`mt-2 text-center text-sm ${isWarning ? 'text-savor' : 'text-text-2'}`}
        >
          {secondsLeft > 0 ? `${secondsLeft}s remaining` : 'Expired'}
        </p>

        <div className={`mt-6 grid ${gridCols} gap-3`}>
          {acceptedMembers.map((member) => (
            <AvatarChip
              key={member.id}
              label={member.name}
              confirmed={member.id === currentUserId ? hasConfirmed : confirmedMemberIds.includes(member.id)}
            />
          ))}
        </div>

        {error ? <p className="mt-5 text-center text-sm text-playful">{error}</p> : null}

        {showStartOver ? (
          <button
            type="button"
            onClick={() => void onStartOver()}
            className="btn-primary mt-8 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            Start over
          </button>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div
              className={`hold-blob-ring ${isHolding ? 'hold-blob-pressing' : ''} ${hasConfirmed ? 'hold-blob-confirmed' : ''}`}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              role="button"
              aria-label={hasConfirmed ? "You're confirmed" : 'Hold to confirm'}
              aria-pressed={hasConfirmed}
            >
              <GumBlob category={category} size={160} morphSeed={2} />
              {!hasConfirmed && (
                <svg
                  width={184}
                  height={184}
                  viewBox="0 0 184 184"
                  style={{
                    position: 'absolute',
                    inset: -12,
                    pointerEvents: 'none',
                    transform: 'rotate(-90deg)',
                  }}
                  aria-hidden
                >
                  <circle
                    className="hold-blob-ring-track"
                    cx={92}
                    cy={92}
                    r={RING_RADIUS}
                  />
                  <circle
                    className="hold-blob-ring-progress"
                    cx={92}
                    cy={92}
                    r={RING_RADIUS}
                    stroke={CATEGORIES[category].color_hex}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
              )}
            </div>
            <p className="text-sm text-text-2">
              {hasConfirmed
                ? "You're in"
                : submitting
                  ? 'Confirming...'
                  : 'Hold to confirm'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

interface AvatarChipProps {
  label: string
  confirmed: boolean
}

function AvatarChip({ label, confirmed }: AvatarChipProps) {
  const initial = useMemo(() => {
    return label.trim().slice(0, 1).toUpperCase() || '?'
  }, [label])

  return (
    <div className="flex items-center gap-3 rounded-full bg-surface-2 px-3 py-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-sm text-text">
        {initial}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full ${confirmed ? 'bg-active text-bg' : 'bg-bg text-text-3'}`}
      >
        {confirmed ? <Check size={14} strokeWidth={2} /> : null}
      </span>
    </div>
  )
}

function getSecondsLeft(expiresAt: string): number {
  const delta = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(delta / 1000))
}
