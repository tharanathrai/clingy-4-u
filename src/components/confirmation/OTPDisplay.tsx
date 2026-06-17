import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'
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

export function OTPDisplay({
  code,
  expiresAt,
  confirmedMemberIds,
  acceptedMembers,
  currentUserId,
  sessionId,
  onBridgeFormed,
  onSessionExpired,
  onStartOver,
}: OTPDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft(expiresAt))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStartOver, setShowStartOver] = useState(false)
  const [localConfirmed, setLocalConfirmed] = useState(false)

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

  const hasConfirmed = localConfirmed || confirmedMemberIds.includes(currentUserId)
  const isWarning = secondsLeft <= 60

  const handleConfirm = async () => {
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
  }

  const memberLabel = acceptedMembers.length <= 2
    ? `Show this to ${acceptedMembers.filter(m => m.id !== currentUserId).map(m => m.name).join(' and ')} - everyone tap confirm`
    : `Share this code — everyone tap confirm`

  const gridCols = acceptedMembers.length <= 2 ? 'grid-cols-2' : acceptedMembers.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

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
            className="btn-primary mt-6 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            Start over
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={hasConfirmed || submitting || secondsLeft <= 0}
            className="btn-primary mt-6 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasConfirmed
              ? "You're confirmed"
              : submitting
                ? 'Confirming...'
                : "I'm here"}
          </button>
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
