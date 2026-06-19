import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { GumBlob } from '../gum/GumBlob.tsx'
import { iconButtonClassName } from '../../lib/iconButton.ts'
import type { Bridge } from '../../types/index.ts'

export interface AcceptedMember {
  id: string
  name: string
  avatarUrl?: string
}

interface OTPDisplayProps {
  code: string
  expiresAt: string
  confirmedMemberIds: string[]
  acceptedMembers: AcceptedMember[]
  currentUserId: string
  sessionId: string
  category: CategorySlug
  activityTitle: string
  onBridgeFormed: (
    bridge: Bridge,
    draftPostId: string | null,
    draftPostBody: string | null,
  ) => void
  onSessionExpired: () => void
  onStartOver: () => Promise<void>
  onNotReady: () => void
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const HOLD_DURATION_MS = 1500
const RING_R = 88
const RING_CIRC = 2 * Math.PI * RING_R

type Stage = 'idle' | 'holding' | 'waiting' | 'allConfirmed' | 'formed' | 'expired'

export function OTPDisplay({
  code,
  expiresAt,
  confirmedMemberIds,
  acceptedMembers,
  currentUserId,
  sessionId,
  category,
  activityTitle,
  onBridgeFormed,
  onSessionExpired,
  onStartOver,
  onNotReady,
}: OTPDisplayProps) {
  const catHex = CATEGORIES[category].color_hex

  const [stage, setStage] = useState<Stage>('idle')
  const [holdProgress, setHoldProgress] = useState(0)
  const [localConfirmed, setLocalConfirmed] = useState(false)
  const [rippleKey, setRippleKey] = useState(0)
  const [particles, setParticles] = useState(false)
  const [blooming, setBlooming] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const allConfirmedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stageRef = useRef<Stage>('idle')

  useEffect(() => { stageRef.current = stage }, [stage])

  useEffect(() => {
    document.body.classList.add('modal-scroll-lock')
    return () => { document.body.classList.remove('modal-scroll-lock') }
  }, [])

  const isMeConf = localConfirmed || confirmedMemberIds.includes(currentUserId)
  const allConfirmed =
    acceptedMembers.length > 0 &&
    acceptedMembers.every(m =>
      m.id === currentUserId ? isMeConf : confirmedMemberIds.includes(m.id),
    )
  const confCount = acceptedMembers.filter(m =>
    m.id === currentUserId ? isMeConf : confirmedMemberIds.includes(m.id),
  ).length

  const otherNames = useMemo(
    () =>
      acceptedMembers
        .filter(m => m.id !== currentUserId)
        .map(m => m.name)
        .join(', '),
    [acceptedMembers, currentUserId],
  )

  // Session expiry timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (new Date(expiresAt).getTime() - Date.now() <= 0) {
        window.clearInterval(timer)
        if (stageRef.current !== 'formed') {
          setStage('expired')
          onSessionExpired()
        }
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt, onSessionExpired])

  // Detect all-confirmed from realtime confirmedMemberIds
  useEffect(() => {
    if (!allConfirmed) return
    if (stageRef.current === 'allConfirmed' || stageRef.current === 'formed') return
    setStage('allConfirmed')
    setParticles(true)
    setRippleKey(k => k + 1)
    allConfirmedTimerRef.current = setTimeout(() => setStage('formed'), 1700)
  }, [allConfirmed])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      if (allConfirmedTimerRef.current) clearTimeout(allConfirmedTimerRef.current)
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (isMeConf || submitting) return
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
      body: JSON.stringify({ session_id: sessionId, otp_code: code }),
    })

    const payload = (await response.json().catch(() => null)) as {
      error?: string
      bridge_formed?: boolean
      bridges?: Bridge[]
      draft_post_id?: string
      draft_post_body?: string
    } | null

    if (!response.ok) {
      if (payload?.error === 'session_expired') {
        setStage('expired')
        onSessionExpired()
      } else {
        setError('Something went wrong. Try again.')
      }
      setSubmitting(false)
      return
    }

    if (payload?.bridge_formed && payload.bridges && payload.bridges.length > 0) {
      onBridgeFormed(
        payload.bridges[0],
        payload.draft_post_id ?? null,
        payload.draft_post_body ?? null,
      )
    } else {
      setLocalConfirmed(true)
      if (stageRef.current !== 'allConfirmed' && stageRef.current !== 'formed') {
        setStage('waiting')
      }
      setRippleKey(k => k + 1)
      setBlooming(b => new Set([...b, currentUserId]))
      setTimeout(
        () => setBlooming(b => { const n = new Set(b); n.delete(currentUserId); return n }),
        600,
      )
    }

    setSubmitting(false)
  }, [isMeConf, submitting, sessionId, code, currentUserId, onBridgeFormed, onSessionExpired])

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null }
    holdStartRef.current = null
    setHoldProgress(0)
    if (stageRef.current === 'holding') setStage('idle')
  }, [])

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      if (
        isMeConf || submitting ||
        stage === 'expired' || stage === 'allConfirmed' || stage === 'formed'
      ) return
      e.currentTarget.setPointerCapture(e.pointerId)
      holdStartRef.current = Date.now()
      setStage('holding')
      setHoldProgress(0)

      holdTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - (holdStartRef.current ?? Date.now())
        const p = Math.min(elapsed / HOLD_DURATION_MS, 1)
        setHoldProgress(p)
        if (p >= 1) {
          clearInterval(holdTimerRef.current!)
          holdTimerRef.current = null
          void handleConfirm()
        }
      }, 30)
    },
    [isMeConf, submitting, stage, handleConfirm],
  )

  const isAllConf = stage === 'allConfirmed' || stage === 'formed'
  const isHolding = stage === 'holding'

  const blobScale =
    isHolding ? 1 + holdProgress * 0.30 :
    isAllConf ? 1.52 :
    isMeConf  ? 1.07 : 1.0

  const glowOpacity =
    isHolding ? 0.18 + holdProgress * 0.52 :
    isAllConf ? 0.80 :
    isMeConf  ? 0.30 : 0.07

  const glowSize =
    isHolding ? 250 + holdProgress * 130 :
    isAllConf ? 420 :
    isMeConf  ? 280 : 200

  const stageLabel: Record<Stage, string> = {
    idle:         'press & hold together',
    holding:      'hold on…',
    waiting:      "you're here · waiting for others",
    allConfirmed: "everyone's here",
    formed:       'forming your bridge…',
    expired:      'the window closed',
  }

  const strokeDashoffset = RING_CIRC * (1 - holdProgress)

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--color-bg)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Header — X only, no "confirm" label */}
      <div style={{
        padding: '14px 12px 0',
        display: 'flex', alignItems: 'center',
        flexShrink: 0, position: 'relative', zIndex: 10,
      }}>
        <button
          type="button"
          onClick={onNotReady}
          className={iconButtonClassName}
          aria-label="Not ready"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Main content — all sections grouped and centered as a unit */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 28px 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        position: 'relative', zIndex: 2,
        overflow: 'hidden',
        gap: 0,
      }}>

        {/* Plan title */}
        <div style={{ textAlign: 'center', marginBottom: 20, flexShrink: 0 }}>
          <p style={{
            margin: 0, fontSize: 11, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
          }}>
            you&apos;re experiencing
          </p>
          <h1 style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: 28, lineHeight: 1.05,
            color: isAllConf ? catHex : 'var(--color-text-primary)',
            transition: 'color 0.8s ease',
          }}>
            {activityTitle}
          </h1>
          {otherNames ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              with {otherNames}
            </p>
          ) : null}
        </div>

        {/* Hold zone: glow + rings + blob */}
        <div style={{
          position: 'relative', width: 220, height: 220,
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}>
          {/* Ambient glow */}
          <div style={{
            position: 'absolute',
            width: glowSize, height: glowSize,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${catHex}55 0%, transparent 68%)`,
            opacity: glowOpacity,
            transition: 'width 0.55s ease, height 0.55s ease, opacity 0.4s ease',
            pointerEvents: 'none',
          }} />

          {/* Hold-breathing overlay */}
          {isHolding && (
            <div style={{
              position: 'absolute',
              width: glowSize * 0.85, height: glowSize * 0.85,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${catHex}33 0%, transparent 65%)`,
              animation: 'glow-breathe 1.1s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}

          {/* Ripple rings */}
          {[0, 1, 2].map(i => (
            <div key={`${rippleKey}-${i}`} style={{
              position: 'absolute',
              width: 144, height: 144, borderRadius: '50%',
              border: `1.5px solid ${catHex}`,
              pointerEvents: 'none', zIndex: 1, opacity: 0,
              animation: rippleKey > 0 ? `ripple-out 1.1s ease-out ${i * 160}ms` : 'none',
            }} />
          ))}

          {/* Progress ring SVG */}
          <svg
            viewBox="0 0 220 220"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
          >
            <circle cx="110" cy="110" r={RING_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
            {!isAllConf && holdProgress > 0 && (
              <circle
                cx="110" cy="110" r={RING_R} fill="none"
                stroke={catHex} strokeWidth="3.5"
                strokeDasharray={RING_CIRC} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
            )}
          </svg>

          {/* Blob */}
          <div
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            style={{
              transform: `scale(${blobScale})`,
              transition: isHolding ? 'transform 0.1s ease' : 'transform 0.55s cubic-bezier(0.34,1.2,0.64,1)',
              cursor: isMeConf ? 'default' : 'pointer',
              userSelect: 'none', touchAction: 'none', WebkitUserSelect: 'none',
              position: 'relative', zIndex: 3,
            }}
            role="button"
            aria-label={isMeConf ? "You're confirmed" : 'Hold to confirm'}
            aria-pressed={isMeConf}
          >
            <GumBlob category={category} size={130} morphSeed={2} />
          </div>

          {/* My confirmation check */}
          {isMeConf && (
            <div style={{ position: 'absolute', bottom: 28, right: 28, zIndex: 4, pointerEvents: 'none' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: 'var(--color-active, #7DD47A)',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 0 0 3px var(--color-bg), 0 0 14px rgba(125,212,122,0.55)',
                animation: 'check-pop 0.42s cubic-bezier(0.34,1.2,0.64,1)',
              }}>
                <Check size={17} color="#fff" />
              </div>
            </div>
          )}

          {/* Particle burst */}
          {particles && <ParticleBurst />}
        </div>

        {/* Status label */}
        <div style={{ marginTop: 20, textAlign: 'center', flexShrink: 0 }}>
          {error ? (
            <p style={{ margin: 0, fontSize: 15, color: 'var(--color-playful, #f07868)' }}>{error}</p>
          ) : (
            <p style={{
              margin: 0,
              fontWeight: isAllConf ? 600 : 400,
              fontSize: 17,
              color: isAllConf ? catHex : isHolding ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              lineHeight: 1.2,
              transition: 'color 0.55s ease',
            }}>
              {submitting ? 'Confirming…' : stageLabel[stage]}
            </p>
          )}

          {!isAllConf && stage !== 'expired' && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              {confCount} of {acceptedMembers.length} here
            </p>
          )}

          {stage === 'formed' && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-tertiary)', animation: 'formed-reveal 0.5s ease-out 120ms both' }}>
              hold tight…
            </p>
          )}

          {stage === 'expired' && (
            <button
              type="button"
              onClick={() => void onStartOver()}
              style={{
                marginTop: 20,
                padding: '12px 32px', borderRadius: 999,
                border: 'none', background: 'var(--color-accent)',
                color: '#fff', fontSize: 15, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Start over
            </button>
          )}
        </div>

        {/* Participant chips — directly below status, not pinned to bottom */}
        <div style={{
          marginTop: 32,
          display: 'flex', justifyContent: 'center',
          gap: acceptedMembers.length > 3 ? 16 : 26,
          flexShrink: 0,
          opacity: stage === 'formed' ? 0 : 1,
          transition: 'opacity 0.55s ease',
        }}>
          {acceptedMembers.map(p => {
            const isMe = p.id === currentUserId
            const confirmed = isMe ? isMeConf : confirmedMemberIds.includes(p.id)
            return (
              <ParticipantChip
                key={p.id}
                name={p.name}
                avatarUrl={p.avatarUrl}
                confirmed={confirmed}
                blooming={blooming.has(p.id)}
                catHex={catHex}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface ParticipantChipProps {
  name: string
  avatarUrl?: string
  confirmed: boolean
  blooming: boolean
  catHex: string
}

function ParticipantChip({ name, avatarUrl, confirmed, blooming, catHex }: ParticipantChipProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      opacity: confirmed ? 1 : 0.28,
      transition: 'opacity 0.55s ease',
      animation: blooming ? 'chip-bloom 0.5s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
    }}>
      <div style={{ position: 'relative' }}>
        {confirmed && (
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: `2px solid ${catHex}`,
            boxShadow: `0 0 16px ${catHex}55`,
            animation: 'pulse-ring 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-2)',
          display: 'grid', placeItems: 'center',
          fontSize: 18, color: 'var(--color-text-primary)', fontWeight: 500,
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initial}
        </div>
        {confirmed && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            backgroundColor: 'var(--color-active, #7DD47A)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 2px var(--color-bg)',
            animation: 'check-pop 0.4s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            <Check size={10} color="#fff" />
          </div>
        )}
      </div>
      <span style={{
        fontSize: 11, letterSpacing: '0.01em',
        fontWeight: confirmed ? 500 : 400,
        color: confirmed ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        transition: 'color 0.4s ease',
      }}>
        {name}
      </span>
    </div>
  )
}

const BURST_CATS = ['playful', 'intimate', 'savor', 'explore', 'recharge', 'active', 'support'] as const
const HEX: Record<string, string> = {
  intimate: '#CF8EE8', active: '#7DD47A', playful: '#F07868',
  explore: '#6DB8F0', recharge: '#82C9A0', savor: '#F0A84A', support: '#E89AA8',
}

function ParticleBurst() {
  const pts = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist = 72 + Math.random() * 88
      return {
        id: i,
        cat: BURST_CATS[i % BURST_CATS.length],
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: i * 28,
        size: 6 + Math.random() * 8,
      }
    })
  }, [])

  return (
    <>
      {pts.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: p.size, height: p.size,
            marginLeft: -p.size / 2, marginTop: -p.size / 2,
            borderRadius: '50%',
            background: HEX[p.cat],
            '--pdx': `${p.dx}px`,
            '--pdy': `${p.dy}px`,
            animation: `particle-pop 0.9s cubic-bezier(0,0,0.2,1) ${p.delay}ms forwards`,
            pointerEvents: 'none', zIndex: 20,
          } as React.CSSProperties}
        />
      ))}
    </>
  )
}
