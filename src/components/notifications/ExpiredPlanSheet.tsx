import { X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { Spinner } from '../Spinner.tsx'
import { useAuth } from '../../hooks/useAuth.ts'
import { supabase } from '../../lib/supabase.ts'

interface ExpiredPlanSheetProps {
  pieceId: string | null
  onClose: () => void
  /** Tapped "Plan it again" — caller opens PieceNew prefilled with these. */
  onReplan: (payload: { recipientIds: string[]; title: string }) => void
  /** Tapped the graveyard link. */
  onViewGraveyard: () => void
}

interface ExpiredPlan {
  id: string
  title: string
  category: string
  expires_at: string
  others: { id: string; display_name: string }[]
}

const categoryDotClass: Record<string, string> = {
  intimate: 'bg-intimate',
  active: 'bg-active',
  playful: 'bg-playful',
  explore: 'bg-explore',
  recharge: 'bg-recharge',
  savor: 'bg-savor',
  support: 'bg-support',
}

function formatOthers(others: { display_name: string }[]): string {
  const names = others.map((o) => o.display_name)
  if (names.length === 0) return 'someone'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Bottom sheet opened from a `plan_expired` notification. Shows what died and offers to
 * plan it again with the same people, so the tap has somewhere useful to go.
 */
export function ExpiredPlanSheet({ pieceId, onClose, onReplan, onViewGraveyard }: ExpiredPlanSheetProps) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ExpiredPlan | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!pieceId) {
      return
    }

    document.body.classList.add('modal-scroll-lock')
    return () => {
      document.body.classList.remove('modal-scroll-lock')
    }
  }, [pieceId])

  useEffect(() => {
    if (!pieceId || !userId) {
      setLoading(false)
      setError(null)
      setPlan(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)

      const [pieceResult, memberResult] = await Promise.all([
        supabase
          .from('gum_pieces')
          .select('id, title, category, expires_at')
          .eq('id', pieceId)
          .maybeSingle<{ id: string; title: string; category: string; expires_at: string }>(),
        supabase
          .from('gum_piece_members')
          .select('user_id')
          .eq('gum_piece_id', pieceId)
          .eq('status', 'accepted')
          .neq('user_id', userId),
      ])

      if (cancelled) return

      if (pieceResult.error || memberResult.error) {
        setError('Something went wrong - try again.')
        setLoading(false)
        return
      }

      if (!pieceResult.data) {
        setPlan(null)
        setLoading(false)
        return
      }

      const otherIds = (memberResult.data ?? []).map((m) => m.user_id as string)
      let others: ExpiredPlan['others'] = []
      if (otherIds.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', otherIds)
        if (cancelled) return
        others = (userRows ?? []).map((u) => ({
          id: u.id as string,
          display_name: u.display_name as string,
        }))
      }

      setPlan({ ...pieceResult.data, others })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pieceId, reloadNonce, userId])

  if (!pieceId) {
    return null
  }

  const expiredAgo = plan
    ? formatDistanceToNow(new Date(plan.expires_at), { addSuffix: true })
    : ''

  return (
    <section className="app-fixed-viewport z-50">
      <button
        type="button"
        aria-label="Close expired plan"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="sheet-slide-up absolute inset-x-0 bottom-0 rounded-t-xl border-t border-white/10 bg-surface px-5 pb-tab-clearance pt-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
          aria-label="Close expired plan"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <h2 className="font-display text-2xl text-text">This one didn&apos;t stick</h2>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <Spinner />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-playful">{error}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                onClick={() => setReloadNonce((value) => value + 1)}
              >
                Retry
              </button>
              <button
                type="button"
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && !plan ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-text-2">This plan is no longer available.</p>
            <button
              type="button"
              className="mt-3 rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : null}

        {!loading && !error && plan ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-11 w-11 shrink-0 rounded-full ${categoryDotClass[plan.category] ?? 'bg-surface'}`}
              />
              <div className="min-w-0">
                <p className="truncate text-base text-text">{plan.title}</p>
                <p className="text-sm text-text-2">with {formatOthers(plan.others)}</p>
                <p className="mt-1 text-xs text-text-3">expired {expiredAgo}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                onClick={() =>
                  onReplan({ recipientIds: plan.others.map((o) => o.id), title: plan.title })
                }
              >
                Plan it again
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-surface px-4 py-2 text-sm font-medium text-text-2"
                onClick={onViewGraveyard}
              >
                See graveyard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
