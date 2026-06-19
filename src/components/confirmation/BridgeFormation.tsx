import { Share2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { GumBlob } from '../gum/GumBlob.tsx'
import type { Bridge } from '../../types/index.ts'
import type { AcceptedMember } from './OTPDisplay.tsx'


interface BridgeFormationProps {
  bridge: Bridge
  activityTitle: string
  draftPostId: string | null
  suggestedPostBody: string | null
  members: AcceptedMember[]
  onComplete: (toast?: string) => void
}

const SZ = 300
const C = SZ / 2
const RAD = 104
const STRAND_DUR = 820
const STRAND_STAG = 150

const HEX: Record<string, string> = {
  intimate: '#CF8EE8', active: '#7DD47A', playful: '#F07868',
  explore: '#6DB8F0', recharge: '#82C9A0', savor: '#F0A84A', support: '#E89AA8',
}

function ease(p: number): number {
  if (p >= 1) return 1
  if (p < 0.86) { const u = p / 0.86; return u * u * (3 - 2 * u) }
  return 1 + Math.sin(((p - 0.86) / 0.14) * Math.PI) * 0.04
}

function layoutNodes(members: AcceptedMember[]) {
  const n = members.length
  return members.map((m, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    return { ...m, x: C + Math.cos(a) * RAD, y: C + Math.sin(a) * RAD, avatarUrl: m.avatarUrl }
  })
}

interface StrandProps {
  to: { x: number; y: number }
  progress: number
  catHex: string
  t: number
  idx: number
}

function Strand({ to, progress, catHex, t, idx }: StrandProps) {
  const e = ease(progress)
  const tipX = C + (to.x - C) * Math.min(e, 1)
  const tipY = C + (to.y - C) * Math.min(e, 1)
  const dx = tipX - C, dy = tipY - C
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const px = -dy / len, py = dx / len
  const settle = progress >= 1 ? 1 : 0
  const sag =
    Math.sin(Math.min(e, 1) * Math.PI) * 14 * (1 - settle * 0.6) +
    settle * (5 + Math.sin(t * 0.0013 + idx) * 1.6)
  const mx = (C + tipX) / 2, my = (C + tipY) / 2
  const cx = mx + px * sag, cy = my + py * sag
  const d = `M${C} ${C} Q${cx} ${cy} ${tipX} ${tipY}`
  const grow = 0.6 + Math.min(e, 1) * 0.4
  if (progress <= 0) return null
  return (
    <g>
      <path d={d} fill="none" stroke={catHex} strokeWidth={16 * grow} strokeOpacity={0.10} strokeLinecap="round" />
      <path d={d} fill="none" stroke={catHex} strokeWidth={7.5 * grow} strokeOpacity={0.34} strokeLinecap="round" />
      <path d={d} fill="none" stroke={catHex} strokeWidth={3.6 * grow} strokeOpacity={0.92} strokeLinecap="round" />
      <path d={d} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.9 * grow} strokeOpacity={0.5} strokeLinecap="round" />
      {progress < 1 && <circle cx={tipX} cy={tipY} r={2.8 * grow} fill={catHex} />}
    </g>
  )
}

export function BridgeFormation({
  bridge,
  activityTitle,
  suggestedPostBody,
  members,
  onComplete,
}: BridgeFormationProps) {
  const category = (bridge.category in CATEGORIES ? bridge.category : 'explore') as CategorySlug
  const catHex = HEX[category] ?? '#6DB8F0'

  const nodes = useMemo(() => layoutNodes(members.length > 0 ? members : [
    { id: 'a', name: 'You' }, { id: 'b', name: 'Them' },
  ]), [members])

  const totalFormMs = (nodes.length - 1) * STRAND_STAG + STRAND_DUR

  const [stage, setStage] = useState<'forming' | 'modal'>('forming')
  const [prog, setProg] = useState<number[]>(nodes.map(() => 0))
  const [showShare, setShowShare] = useState(false)
  const [postBody, setPostBody] = useState(suggestedPostBody ?? activityTitle)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const timeRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const scheduledRef = useRef(false)
  const stageRef = useRef<'forming' | 'modal'>('forming')
  stageRef.current = stage

  useEffect(() => {
    document.body.classList.add('modal-scroll-lock')
    return () => { document.body.classList.remove('modal-scroll-lock') }
  }, [])

  useEffect(() => {
    setPostBody(suggestedPostBody ?? activityTitle)
  }, [activityTitle, suggestedPostBody])

  useEffect(() => {
    startRef.current = null
    scheduledRef.current = false

    const id = setInterval(() => {
      timeRef.current = performance.now()
      if (stageRef.current === 'forming') {
        if (startRef.current === null) startRef.current = performance.now()
        const el = performance.now() - startRef.current
        setProg(nodes.map((_, i) => Math.max(0, Math.min((el - i * STRAND_STAG) / STRAND_DUR, 1))))
        if (el >= totalFormMs && !scheduledRef.current) {
          scheduledRef.current = true
          setTimeout(() => { if (stageRef.current === 'forming') setStage('modal') }, 700)
        }
      }
      setTick(t => t + 1)
    }, 16)

    return () => clearInterval(id)
  }, [nodes, totalFormMs])

  const formed = prog.length > 0 && prog.every(p => p >= 1)
  const t = timeRef.current

  const handlePost = async () => {
    if (submitting || postBody.trim().length === 0 || postBody.length > 500) return
    setSubmitting(true)
    setError(null)

    const { error: createError } = await supabase.functions.invoke('create-post', {
      body: { bridge_id: bridge.id, body: postBody.trim(), is_public: true },
    })

    if (createError) {
      setError('Could not post right now. Try again.')
      setSubmitting(false)
      return
    }

    onComplete('Posted to your network!')
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--color-bg)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 20, paddingRight: 20, paddingBottom: 288,
    }}>

      {/* Plan title */}
      <div style={{ textAlign: 'center', zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
          your new bridge
        </p>
        <h1 style={{
          margin: '8px 0 0',
          fontFamily: 'var(--font-display)', fontWeight: 400,
          fontSize: 28, lineHeight: 1.05,
          color: formed ? catHex : 'var(--color-text-primary)',
          transition: 'color 0.7s ease',
        }}>
          {activityTitle}
        </h1>
      </div>

      {/* Hub scene */}
      <div style={{ position: 'relative', width: SZ, height: SZ, zIndex: 2, marginTop: 28 }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 270, height: 270,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${catHex}55 0%, transparent 68%)`,
          opacity: formed ? 0.55 : 0.12 + (prog[0] ?? 0) * 0.28,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }} />

        {/* Strands */}
        <svg viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ} style={{ position: 'absolute', inset: 0 }}>
          {nodes.map((n, i) => (
            <Strand key={n.id} to={n} progress={prog[i] ?? 0} catHex={catHex} t={t} idx={i} />
          ))}
        </svg>

        {/* Centre gum blob */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: `translate(-50%,-50%) scale(${formed ? 1.06 : 1})`,
          transition: 'transform 0.5s cubic-bezier(0.34,1.2,0.64,1)',
          zIndex: 2,
        }}>
          <GumBlob category={category} size={74} />
        </div>

        {/* Member avatars */}
        {nodes.map((n, i) => {
          const initial = n.name.trim().slice(0, 1).toUpperCase() || '?'
          return (
            <div key={n.id} style={{
              position: 'absolute', left: n.x, top: n.y, zIndex: 3,
              transform: 'translate(-50%,-50%)',
              animation: formed ? `avatar-settle 0.5s cubic-bezier(0.34,1.2,0.64,1) ${i * 60}ms both` : 'none',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: 'var(--color-surface-2)',
                border: `2px solid ${catHex}55`,
                display: 'grid', placeItems: 'center',
                fontSize: 18, color: 'var(--color-text-primary)', fontWeight: 500,
              }}>
                {n.avatarUrl ? (
                  <img src={n.avatarUrl} alt={n.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : initial}
              </div>
            </div>
          )
        })}
      </div>

      {/* Share prompt — fixed bottom panel */}
      {stage === 'modal' && !showShare && (
        <div className="app-fixed-frame safe-bottom-24 px-5" style={{ zIndex: 80 }}>
          <div className="app-fixed-frame-inner rounded-xl border border-white/10 bg-surface p-4 shadow-card sheet-slide-up">

            {/* Avatar preview row */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                display: 'flex', padding: '8px 14px', borderRadius: 99,
                background: `${catHex}1f`, boxShadow: `0 0 22px ${catHex}33`,
              }}>
                {members.map((m, i) => {
                  const initial = m.name.trim().slice(0, 1).toUpperCase() || '?'
                  return (
                    <div key={m.id} style={{ marginLeft: i ? -10 : 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-surface-2)',
                        border: `2px solid ${catHex}66`,
                        display: 'grid', placeItems: 'center',
                        fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500,
                      }}>
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : initial}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <h2 style={{ margin: '0 0 6px', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 24, color: 'var(--color-text-primary)' }}>
              share this bridge?
            </h2>
            <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
              let your people see that you {members.length > 2 ? 'all' : `and ${members.find(m => m.id !== members[0]?.id)?.name ?? 'them'}`} actually showed up.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowShare(true)}
                style={{
                  width: '100%', padding: '13px', borderRadius: 999,
                  border: 'none', background: catHex,
                  color: '#fff', fontSize: 15, fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Share2 size={17} color="#fff" />
                share to feed
              </button>
              <button
                type="button"
                onClick={() => onComplete()}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 15,
                  padding: '10px', color: 'var(--color-text-tertiary)',
                }}
              >
                keep it private
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share textarea panel */}
      {stage === 'modal' && showShare && (
        <div className="app-fixed-frame safe-bottom-24 px-5" style={{ zIndex: 80 }}>
          <div className="app-fixed-frame-inner rounded-xl border border-white/10 bg-surface p-4 shadow-card sheet-slide-up">
            <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22, color: 'var(--color-text-primary)' }}>
              Share this?
            </h2>
            <textarea
              value={postBody}
              onChange={e => setPostBody(e.target.value)}
              maxLength={500}
              className="post-optin-textarea mt-3 w-full rounded-md border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none"
              placeholder="Write your post…"
              rows={4}
            />
            <p style={{ margin: '4px 0 12px', textAlign: 'right', fontSize: 12, color: 'var(--color-text-tertiary)' }}>{postBody.length} / 500</p>
            {error ? <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-playful, #f07868)' }}>{error}</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={submitting || postBody.trim().length === 0 || postBody.length > 500}
                style={{
                  padding: '12px', borderRadius: 999, border: 'none',
                  background: catHex, color: '#fff',
                  fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)',
                  cursor: 'pointer', opacity: (submitting || postBody.trim().length === 0) ? 0.6 : 1,
                }}
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
              <button
                type="button"
                onClick={() => onComplete()}
                disabled={submitting}
                style={{
                  padding: '12px', borderRadius: 999, border: 'none',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 15, fontFamily: 'var(--font-body)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
