import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { GumBlob } from '../components/gum/GumBlob.tsx'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfileReady } from '../hooks/useProfileReady.ts'
import type { CategorySlug } from '../lib/constants.ts'

interface BlobState {
  id: number
  cat: CategorySlug
  size: number
  x: number
  y: number
  vx: number
  vy: number
}

const SEED: BlobState[] = [
  { id: 0, cat: 'intimate', size: 92, x: 96,  y: 250, vx:  0.16, vy:  0.11 },
  { id: 1, cat: 'playful',  size: 72, x: 290, y: 210, vx: -0.13, vy:  0.15 },
  { id: 2, cat: 'explore',  size: 60, x: 320, y: 410, vx: -0.14, vy: -0.10 },
  { id: 3, cat: 'savor',    size: 80, x: 78,  y: 470, vx:  0.12, vy: -0.13 },
  { id: 4, cat: 'active',   size: 54, x: 200, y: 360, vx:  0.15, vy:  0.12 },
  { id: 5, cat: 'recharge', size: 66, x: 300, y: 560, vx: -0.12, vy: -0.14 },
  { id: 6, cat: 'support',  size: 50, x: 110, y: 600, vx:  0.13, vy: -0.12 },
]

const MIN_SPD = 0.10
const MAX_SPD = 0.5
const PAD = 20

export default function Landing() {
  const { user, loading, signInWithGoogle } = useAuth()
  const { profileReady, isLoading: profileLoading } = useProfileReady(user?.id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const blobsRef = useRef<BlobState[]>(SEED.map(b => ({ ...b })))
  const heldRef = useRef<{
    id: number
    pid: number
    dxOff: number
    dyOff: number
    vx: number
    vy: number
    lastT: number
    lastX: number
    lastY: number
  } | null>(null)
  const [heldId, setHeldId] = useState<number | null>(null)
  const [, setTick] = useState(0)

  const localXY = (e: PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onDown = (e: React.PointerEvent, id: number) => {
    e.preventDefault()
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* not all environments support pointer capture */ }
    const b = blobsRef.current.find(x => x.id === id)!
    const r = stageRef.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    heldRef.current = { id, pid: e.pointerId, dxOff: x - b.x, dyOff: y - b.y, vx: 0, vy: 0, lastT: performance.now(), lastX: x, lastY: y }
    b.vx = 0; b.vy = 0
    setHeldId(id)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const h = heldRef.current
      if (!h) return
      const b = blobsRef.current.find(x => x.id === h.id)!
      const { x, y } = localXY(e)
      const nx = x - h.dxOff
      const ny = y - h.dyOff
      const now = performance.now()
      const dt = Math.max(now - h.lastT, 8)
      h.vx = (nx - b.x) / dt * 16
      h.vy = (ny - b.y) / dt * 16
      h.lastT = now
      b.x = nx; b.y = ny
      setTick(t => t + 1)
    }
    const onUp = () => {
      const h = heldRef.current
      if (!h) return
      const b = blobsRef.current.find(x => x.id === h.id)!
      b.vx = Math.max(-3.5, Math.min(3.5, h.vx || 0)) || (Math.random() - 0.5) * 0.3
      b.vy = Math.max(-3.5, Math.min(3.5, h.vy || 0)) || (Math.random() - 0.5) * 0.3
      heldRef.current = null
      setHeldId(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const step = () => {
      const W = stage?.clientWidth ?? 390
      const H = stage?.clientHeight ?? 780
      const heldNow = heldRef.current?.id ?? null
      for (const b of blobsRef.current) {
        if (b.id === heldNow) continue
        b.vx += (Math.random() - 0.5) * 0.012
        b.vy += (Math.random() - 0.5) * 0.012
        b.vx *= 0.995; b.vy *= 0.995
        let spd = Math.hypot(b.vx, b.vy)
        if (spd < MIN_SPD) {
          const a = Math.atan2(b.vy || 0.001, b.vx || 0.001)
          b.vx = Math.cos(a) * MIN_SPD; b.vy = Math.sin(a) * MIN_SPD; spd = MIN_SPD
        }
        if (spd > MAX_SPD) { b.vx *= MAX_SPD / spd; b.vy *= MAX_SPD / spd }
        b.x += b.vx; b.y += b.vy
        const r = b.size / 2 + PAD
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.8 }
        if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.8 }
        if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * 0.8 }
        if (b.y > H - r) { b.y = H - r; b.vy = -Math.abs(b.vy) * 0.8 }
      }
      setTick(t => t + 1)
    }
    const id = setInterval(step, 16)
    return () => clearInterval(id)
  }, [])

  if (loading || (user && (profileLoading || profileReady === null))) {
    return <FullScreenSpinner />
  }

  if (user) {
    return <Navigate to={profileReady ? '/home' : '/welcome'} replace />
  }

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch {
      setErrorMessage('Something went wrong - try again.')
      setSubmitting(false)
    }
  }

  return (
    <main
      ref={stageRef}
      className="safe-screen-height mx-auto w-full max-w-md bg-bg relative overflow-hidden touch-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[9999] opacity-[0.038]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.85'/%3E%3C/svg%3E")`,
        }}
      />

      {/* drifting blobs */}
      <div className="absolute inset-0 z-[1]">
        {blobsRef.current.map(b => {
          const held = heldId === b.id
          return (
            <div
              key={b.id}
              onPointerDown={(e) => onDown(e, b.id)}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${b.x - b.size / 2}px, ${b.y - b.size / 2}px)`,
                cursor: held ? 'grabbing' : 'grab',
                touchAction: 'none',
                zIndex: held ? 30 : 5,
                willChange: 'transform',
              }}
            >
              <div
                style={{
                  transform: `scale(${held ? 1.2 : 1})`,
                  transition: 'transform 0.22s cubic-bezier(0.34,1.4,0.64,1)',
                  filter: held ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.45))' : 'none',
                  animation: held ? 'wiggle 0.5s ease-in-out infinite' : 'none',
                }}
              >
                <GumBlob category={b.cat} size={b.size} morphSeed={b.id} />
              </div>
            </div>
          )
        })}
      </div>

      {/* title */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 text-center"
        style={{ top: 92 }}
      >
        <h1
          className="font-display text-text"
          style={{
            margin: 0,
            fontSize: 56,
            lineHeight: 1,
            fontWeight: 400,
            animation: 'title-glow 4.5s ease-in-out infinite',
          }}
        >
          clingy
        </h1>
        <p
          className="text-text-2 mx-auto mt-4"
          style={{ maxWidth: 260, fontSize: 17, lineHeight: 1.45 }}
        >
          make plans that stick
        </p>
      </div>

      {/* CTA */}
      <div
        className="absolute left-0 right-0 bottom-0 z-20 flex flex-col items-center gap-3.5"
        style={{
          padding: '56px 28px 48px',
          background: 'linear-gradient(to top, var(--color-bg) 38%, transparent)',
        }}
      >
        <button
          type="button"
          className="btn-primary flex w-full max-w-xs items-center justify-center gap-3 rounded-full bg-accent px-7 py-3.5 font-body text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void handleGoogleSignIn()}
          disabled={submitting}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="#fff">
            <path d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.6 2.8-4 2.8-7s-1-5.4-2.8-7l-3.1 2.4c1 .7 1.7 1.7 1.9 2.9H12z" />
            <path d="M12 24c2.5 0 4.6-.8 6.1-2.2l-3.1-2.4c-.9.6-2 .9-3.1.9-2.4 0-4.5-1.6-5.2-3.8H3.5v2.4C5 21.8 8.2 24 12 24z" />
            <path d="M6.8 14.5c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V8.5H3.5C2.9 9.8 2.5 11.3 2.5 12.7s.4 2.9 1 4.2l3.3-2.4z" />
            <path d="M12 5.1c1.4 0 2.6.5 3.6 1.3l2.7-2.7C16.6 2.1 14.5 1 12 1 8.2 1 5 3.2 3.5 6.1l3.3 2.4c.7-2.2 2.8-3.4 5.2-3.4z" />
          </svg>
          <span>{submitting ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        {errorMessage ? (
          <p className="text-sm text-playful">{errorMessage}</p>
        ) : null}
      </div>
    </main>
  )
}
