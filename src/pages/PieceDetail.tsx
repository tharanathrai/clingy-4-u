import { format, formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { GumBlob } from '../components/gum/GumBlob.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellCentered, pageShellScroll } from '../components/layout/pageShell.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { debouncedInvalidateQueries } from '../lib/debouncedInvalidate.ts'
import { invalidateGumPieceFlow } from '../lib/invalidate.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
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
  planned_date: string | null
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

  const { data: pieceData, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchPieceDetail(id!, userId!),
    enabled: !authLoading && Boolean(id) && userId !== null,
    staleTime: 30 * 1000,
  })
  const loading = isInitialQueryLoading(authLoading, userId, isPending)

  useEffect(() => {
    if (!id || !userId) return
    return subscribePostgresChannel(`piece-detail-rt-${id}`, [
      {
        event: '*',
        table: 'gum_pieces',
        filter: `id=eq.${id}`,
        callback: () => { debouncedInvalidateQueries(queryClient, queryKey) },
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
    onSuccess: () => {
      setShowTurnDownConfirm(false)
      if (userId && id) {
        invalidateGumPieceFlow(userId, queryClient, id)
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

  const remainingProgress = useMemo(() => {
    if (!piece) return 0
    const start = new Date(piece.created_at).getTime()
    const end = new Date(piece.expires_at).getTime()
    if (end <= start) return 0
    const remainingMs = Math.max(0, end - Date.now())
    return Math.round((remainingMs / (end - start)) * 100)
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
  const busyAction = respondMutation.isPending
    ? (respondMutation.variables as 'accept' | 'turn_down' | null)
    : null

  if (!id) return <Navigate to="/home" replace />

  if (loading) {
    return (
      <main className={pageShellScroll}>
        <div className="skeleton mb-2 h-11 w-16 rounded" />
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
        <main className={`${pageShellCentered} px-5`}>
          <p className="text-sm text-text-2">Couldn&apos;t load this plan.</p>
          <button
            type="button"
            onClick={() => { debouncedInvalidateQueries(queryClient, queryKey) }}
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
    <main className={pageShellScroll}>
      <BackHeader onBack={handleBack} className="mb-2" />

      <div className="flex justify-center">
        <GumBlob category={category} size={136} />
      </div>
      <h1 className="mt-4 text-center font-display text-3xl text-text">{piece.title}</h1>
      <div className="mt-3 flex justify-center">
        <CategoryChip category={category} size="md" />
      </div>
      {partner ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-sm text-text-2">with</span>
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
          <Link to={`/profile/${partner.username}`} className="text-sm font-medium text-text underline underline-offset-2">
            {partner.display_name}
          </Link>
        </div>
      ) : null}
      <p className="mt-3 text-center text-sm text-text-2">{statusLine}</p>
      {piece.planned_date ? (
        <p className="mt-1 text-center text-xs text-text-3">
          by {format(new Date(piece.planned_date + 'T00:00:00Z'), 'MMM d, yyyy')}
        </p>
      ) : null}

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-none ${fillClass}`}
          style={{ width: `${remainingProgress}%` }}
        />
      </div>

      <section className="mt-10 space-y-3 pb-24">
        {canAccept ? (
          <>
            <button
              type="button"
              onClick={() => respondMutation.mutate('accept')}
              disabled={busyAction !== null}
              className="btn-primary w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => respondMutation.mutate('turn_down')}
              disabled={busyAction !== null}
              className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'turn_down' ? 'Cancelling...' : 'Cancel'}
          </button>
        ) : null}

        {canTurnDownActive ? (
          <>
            <button
              type="button"
              onClick={() => void navigate(`/piece/${piece.id}/confirm`)}
              className="btn-primary w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Mark as done
            </button>
            {!showTurnDownConfirm ? (
              <button
                type="button"
                onClick={() => setShowTurnDownConfirm(true)}
                className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
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
                    className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-text-2 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTurnDownConfirm(false)}
                    className="btn-primary flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
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
