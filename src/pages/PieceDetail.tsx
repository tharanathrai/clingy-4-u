import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

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

interface ParticipantMeta {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
}

interface PieceDetailData {
  piece: PieceDetailRow
  creator: ParticipantMeta | null
  recipient: ParticipantMeta | null
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchPieceDetail(id: string, userId: string): Promise<PieceDetailData | null> {
  const { data, error: pieceError } = await supabase
    .from('gum_pieces')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (pieceError) throw new Error(pieceError.message)
  if (!data) return null

  if (data.creator_id !== userId && data.recipient_id !== userId) return null

  const { data: participantRows } = await supabase
    .from('users')
    .select('id, display_name, username, avatar_url')
    .in('id', [data.creator_id, data.recipient_id])

  const creator = (participantRows?.find((row) => row.id === data.creator_id) ?? null) as ParticipantMeta | null
  const recipient = (participantRows?.find((row) => row.id === data.recipient_id) ?? null) as ParticipantMeta | null

  return { piece: data as PieceDetailRow, creator, recipient }
}

export default function PieceDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showTurnDownConfirm, setShowTurnDownConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const previousStatusRef = useRef<PieceDetailRow['status'] | null>(null)

  const queryKey = queryKeys.pieceDetail(id, userId)

  const { data: pieceData, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchPieceDetail(id!, userId!),
    enabled: !authLoading && Boolean(id) && userId !== null,
    staleTime: 0,
  })

  useEffect(() => {
    if (!id || !userId) return
    return subscribePostgresChannel(`piece-detail-rt-${id}`, [
      {
        event: '*',
        table: 'gum_pieces',
        filter: `id=eq.${id}`,
        callback: () => { void queryClient.invalidateQueries({ queryKey }) },
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, queryClient, userId])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const piece = pieceData?.piece ?? null
  const creator = pieceData?.creator ?? null
  const recipient = pieceData?.recipient ?? null

  // Detect status changes for redirects
  useEffect(() => {
    if (!piece) {
      previousStatusRef.current = null
      return
    }

    const previousStatus = previousStatusRef.current
    previousStatusRef.current = piece.status

    if (!previousStatus || previousStatus === piece.status) return

    if (piece.status === 'confirmed') {
      navigate('/home', {
        replace: true,
        state: { toast: 'Bridge formed while you were away.' },
      })
      return
    }

    if (piece.status === 'expired') {
      setToast('This plan expired.')
      const timeoutId = window.setTimeout(() => navigate('/home', { replace: true }), 2000)
      return () => window.clearTimeout(timeoutId)
    }
  }, [navigate, piece])

  const respondMutation = useMutation({
    mutationFn: async (action: 'accept' | 'turn_down') => {
      if (!piece) throw new Error('No piece')
      let accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Session expired')

      let response = await callRespondFunction(piece.id, action, accessToken)
      if (response.status === 401) {
        accessToken = await getValidAccessToken(true)
        if (accessToken) response = await callRespondFunction(piece.id, action, accessToken)
      }

      if (!response.ok) {
        let errorCode: string | null = null
        try {
          const payload = (await response.json()) as { error?: string }
          errorCode = payload.error ?? null
        } catch {
          errorCode = null
        }
        throw new Error(
          action === 'accept' && errorCode === 'invalid_status'
            ? 'This invite has expired.'
            : 'Something went wrong - try again.',
        )
      }
    },
    onSuccess: (_, action) => {
      setShowTurnDownConfirm(false)
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['gum-pieces', userId] })
      if (action === 'accept') {
        void queryClient.invalidateQueries({ queryKey: ['gum-pieces', userId] })
      }
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : 'Something went wrong - try again.')
    },
  })

  const category = useMemo(() => toCategorySlug(piece?.category), [piece?.category])

  const statusLine = useMemo(() => {
    if (!piece || !userId) return ''

    const otherName =
      userId === piece.creator_id
        ? recipient?.display_name ?? 'them'
        : creator?.display_name ?? 'them'
    if (piece.status === 'placeholder') return `Waiting for ${otherName} to accept`
    if (piece.status === 'active') return `Active · ${formatDistanceToNow(new Date(piece.expires_at), { addSuffix: false })} left`
    if (piece.status === 'turned_down') return 'Turned down'
    if (piece.status === 'expired') return 'Expired'
    return 'Confirmed'
  }, [creator, piece, recipient, userId])

  const expiryProgress = useMemo(() => {
    if (!piece) return 0
    const start = new Date(piece.accepted_at ?? piece.created_at).getTime()
    const end = new Date(piece.expires_at).getTime()
    const now = Date.now()
    if (end <= start) return 100
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
  const busyAction = respondMutation.isPending
    ? (respondMutation.variables as 'accept' | 'turn_down' | null)
    : null

  if (!id) return <Navigate to="/home" replace />

  if (authLoading || isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-8 pt-6 text-text">
        <div className="mb-6">
          <div className="skeleton h-5 w-16 rounded" />
        </div>
        <div className="mx-auto skeleton h-24 w-24 rounded-full" />
        <div className="mx-auto mt-4 skeleton h-8 w-48 rounded" />
        <div className="mx-auto mt-3 skeleton h-5 w-24 rounded-full" />
        <div className="mt-10 space-y-3">
          <div className="skeleton h-12 w-full rounded-full" />
          <div className="skeleton h-12 w-full rounded-full" />
        </div>
      </main>
    )
  }

  if (error || !piece || !userId) {
    if (error) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 text-center text-text">
          <p className="text-sm text-text-2">Couldn&apos;t load this plan.</p>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey })}
            className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
          >
            Retry
          </button>
        </main>
      )
    }
    return <Navigate to="/home" replace />
  }

  const isRecipient = userId === piece.recipient_id
  const canAccept = piece.status === 'placeholder' && isRecipient
  const canCancelPlaceholder = piece.status === 'placeholder' && !isRecipient
  const canTurnDownActive = piece.status === 'active'
  const readOnly = ['confirmed', 'expired', 'turned_down'].includes(piece.status)
  const partner = userId === piece.creator_id ? recipient : creator

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-8 pt-6 text-text">
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-text-2"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
          back
        </button>
      </div>

      <div className={`mx-auto h-24 w-24 gum-morph-base gum-morph-37 ${fillClass}`} />
      <h1 className="mt-4 text-center font-display text-3xl text-text">{piece.title}</h1>
      <div className="mt-3 flex justify-center">
        <CategoryChip category={category} size="md" />
      </div>
      {partner ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {partner.avatar_url ? (
            <img
              src={partner.avatar_url}
              alt={partner.display_name}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs text-text-2">
              {partner.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm text-text-2">with</span>
          <Link to={`/profile/${partner.username}`} className="text-sm text-text underline-offset-2 hover:underline">
            {partner.display_name}
          </Link>
        </div>
      ) : null}
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
              onClick={() => respondMutation.mutate('accept')}
              disabled={busyAction !== null}
              className="w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => respondMutation.mutate('turn_down')}
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
            onClick={() => respondMutation.mutate('turn_down')}
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
            <p className="text-center text-xs text-text-3">
              you&apos;ll need to be with them to do this
            </p>
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
                <p className="text-sm text-text">Are you sure? This can&apos;t be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respondMutation.mutate('turn_down')}
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
            {piece.status === 'expired'
              ? "This one didn't happen. That's okay."
              : piece.status === 'turned_down'
                ? 'Passed on. No hard feelings.'
                : 'This one is complete.'}
          </p>
        ) : null}
      </section>

      {toast ? (
        <div className="app-fixed-frame safe-bottom-24 px-5">
          <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        </div>
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

async function callRespondFunction(
  gumPieceId: string,
  action: 'accept' | 'turn_down',
  accessToken: string,
): Promise<Response> {
  return fetch(`${functionsBaseUrl}/respond-gum-piece`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      gum_piece_id: gumPieceId,
      action,
    }),
  })
}

async function getValidAccessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    return refreshData.session?.access_token ?? null
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const existingToken = sessionData.session?.access_token
  if (existingToken) return existingToken

  const { data: refreshData } = await supabase.auth.refreshSession()
  return refreshData.session?.access_token ?? null
}
