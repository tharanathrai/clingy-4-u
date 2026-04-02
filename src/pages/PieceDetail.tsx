import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'

interface PieceDetailRow {
  id: string
  creator_id: string
  recipient_id: string
  title: string
  category: string
  color_hex: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
  created_at: string
  accepted_at: string | null
  expires_at: string
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function PieceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [piece, setPiece] = useState<PieceDetailRow | null>(null)
  const [creatorName, setCreatorName] = useState('Someone')
  const [recipientName, setRecipientName] = useState('Someone')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'accept' | 'turn_down' | null>(null)
  const [showTurnDownConfirm, setShowTurnDownConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadPiece = useCallback(async () => {
    if (!id || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: pieceError } = await supabase
      .from('gum_pieces')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (pieceError) {
      setError(pieceError.message)
      setLoading(false)
      return
    }

    if (!data) {
      setPiece(null)
      setLoading(false)
      return
    }

    if (data.creator_id !== user.id && data.recipient_id !== user.id) {
      setPiece(null)
      setLoading(false)
      return
    }

    setPiece(data as PieceDetailRow)

    const { data: participantRows } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', [data.creator_id, data.recipient_id])

    const creator = participantRows?.find((row) => row.id === data.creator_id)
    const recipient = participantRows?.find((row) => row.id === data.recipient_id)
    if (creator) {
      setCreatorName(creator.display_name)
    }
    if (recipient) {
      setRecipientName(recipient.display_name)
    }

    setLoading(false)
  }, [id, user])

  useEffect(() => {
    void loadPiece()
  }, [loadPiece])

  useEffect(() => {
    if (!id) {
      return
    }

    const channel = supabase
      .channel(`piece-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gum_pieces',
          filter: `id=eq.${id}`,
        },
        () => {
          void loadPiece()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, loadPiece])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  const category = useMemo(() => toCategorySlug(piece?.category), [piece?.category])

  const statusLine = useMemo(() => {
    if (!piece || !user) {
      return ''
    }

    const otherName = user.id === piece.creator_id ? recipientName : creatorName
    if (piece.status === 'placeholder') {
      return `Waiting for ${otherName} to accept`
    }
    if (piece.status === 'active') {
      return `Active · ${formatDistanceToNow(new Date(piece.expires_at), { addSuffix: false })} left`
    }
    if (piece.status === 'turned_down') {
      return 'Turned down'
    }
    if (piece.status === 'expired') {
      return 'Expired'
    }
    return 'Confirmed'
  }, [creatorName, piece, recipientName, user])

  const expiryProgress = useMemo(() => {
    if (!piece) {
      return 0
    }

    const start = new Date(piece.accepted_at ?? piece.created_at).getTime()
    const end = new Date(piece.expires_at).getTime()
    const now = Date.now()
    if (end <= start) {
      return 100
    }

    const elapsed = Math.max(0, Math.min(now - start, end - start))
    return Math.round((elapsed / (end - start)) * 100)
  }, [piece])
  const fillClass = useMemo(() => {
    if (category === 'intimate') return 'bg-intimate'
    if (category === 'active') return 'bg-active'
    if (category === 'playful') return 'bg-playful'
    if (category === 'explore') return 'bg-explore'
    if (category === 'recharge') return 'bg-recharge'
    if (category === 'savor') return 'bg-savor'
    return 'bg-support'
  }, [category])
  const filledSegments = Math.max(0, Math.min(20, Math.round((expiryProgress / 100) * 20)))

  const respond = async (action: 'accept' | 'turn_down') => {
    if (!piece) {
      return
    }

    setBusyAction(action)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setToast('Something went wrong - try again.')
      setBusyAction(null)
      return
    }

    const response = await fetch(`${functionsBaseUrl}/respond-gum-piece`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        gum_piece_id: piece.id,
        action,
      }),
    })

    if (!response.ok) {
      setToast('Something went wrong - try again.')
      setBusyAction(null)
      return
    }

    await loadPiece()
    setShowTurnDownConfirm(false)
    setBusyAction(null)
  }

  if (!id) {
    return <Navigate to="/home" replace />
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading piece...</p>
      </main>
    )
  }

  if (!piece || !user) {
    return <Navigate to="/home" replace />
  }

  const isRecipient = user.id === piece.recipient_id
  const canAccept = piece.status === 'placeholder' && isRecipient
  const canCancelPlaceholder = piece.status === 'placeholder' && !isRecipient
  const canTurnDownActive = piece.status === 'active'
  const readOnly = ['confirmed', 'expired', 'turned_down'].includes(piece.status)

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-8 pt-6 text-text">
      <div className="mb-6">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-text-2">
          <ArrowLeft size={18} strokeWidth={1.75} />
          back
        </Link>
      </div>

      {error ? <p className="mb-3 text-sm text-playful">{error}</p> : null}

      <div className={`mx-auto h-24 w-24 gum-morph-base gum-morph-37 ${fillClass}`} />
      <h1 className="mt-4 text-center font-display text-3xl text-text">{piece.title}</h1>
      <div className="mt-3 flex justify-center">
        <CategoryChip category={category} size="md" />
      </div>
      <p className="mt-3 text-center text-sm text-text-2">{statusLine}</p>

      <div className="mt-5 flex gap-0.5 rounded-full bg-surface-2 p-0.5">
        {Array.from({ length: 20 }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index < filledSegments ? fillClass : 'bg-surface'}`}
          />
        ))}
      </div>

      <section className="mt-10 space-y-3 pb-24">
        {canAccept ? (
          <>
            <button
              type="button"
              onClick={() => void respond('accept')}
              disabled={busyAction !== null}
              className="w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => void respond('turn_down')}
              disabled={busyAction !== null}
              className="w-full rounded-full border border-playful/40 bg-transparent px-7 py-3.5 text-sm font-medium text-playful disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'turn_down' ? 'Passing...' : 'Pass'}
            </button>
          </>
        ) : null}

        {canCancelPlaceholder ? (
          <button
            type="button"
            onClick={() => void respond('turn_down')}
            disabled={busyAction !== null}
            className="w-full rounded-full border border-playful/40 bg-transparent px-7 py-3.5 text-sm font-medium text-playful disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'turn_down' ? 'Cancelling...' : 'Cancel'}
          </button>
        ) : null}

        {canTurnDownActive ? (
          <>
            <button
              type="button"
              onClick={() => void navigate(`/piece/${piece.id}/confirm`)}
              className="w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Mark as done
            </button>
            {!showTurnDownConfirm ? (
              <button
                type="button"
                onClick={() => setShowTurnDownConfirm(true)}
                className="w-full rounded-full border border-playful/40 bg-transparent px-7 py-3.5 text-sm font-medium text-playful"
              >
                Turn down
              </button>
            ) : (
              <div className="rounded-xl bg-surface p-4">
                <p className="text-sm text-text">Are you sure? This can't be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respond('turn_down')}
                    disabled={busyAction !== null}
                    className="flex-1 rounded-full border border-playful/40 px-4 py-2 text-sm text-playful disabled:opacity-50"
                  >
                    Confirm turn down
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTurnDownConfirm(false)}
                    className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-sm text-text-2"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {readOnly ? (
          <p className="text-center text-sm text-text-2">
            This plan is read-only now.
          </p>
        ) : null}
      </section>

      {toast ? (
        <p className="fixed inset-x-5 bottom-24 rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
          {toast}
        </p>
      ) : null}
    </main>
  )
}

function toCategorySlug(value?: string): CategorySlug {
  if (value && value in CATEGORIES) {
    return value as CategorySlug
  }

  return 'explore'
}
