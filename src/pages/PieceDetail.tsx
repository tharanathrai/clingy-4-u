import { format, formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { CategoryPicker } from '../components/gum/CategoryPicker.tsx'
import { GumBlob } from '../components/gum/GumBlob.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellCentered, pageShellScroll, toastFrameClass } from '../components/layout/pageShell.ts'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { categorizeTitle } from '../lib/categorizeTitle.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { debouncedInvalidateQueries } from '../lib/debouncedInvalidate.ts'
import { invalidateGumPieceFlow, invalidateGumPieces } from '../lib/invalidate.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'
import type { GumPieceMember, PendingEdit } from '../types/index.ts'

interface PieceDetailRow {
  id: string
  creator_id: string
  recipient_id: string | null
  title: string
  category: string
  color_hex: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
  created_at: string
  accepted_at: string | null
  expires_at: string
  planned_date: string | null
  pending_edit: PendingEdit | null
}

interface PieceDetailData {
  piece: PieceDetailRow
  members: GumPieceMember[]
  myMember: GumPieceMember | null
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchPieceDetail(id: string, userId: string): Promise<PieceDetailData | null> {
  const [pieceResult, memberResult] = await Promise.all([
    supabase.from('gum_pieces').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('gum_piece_members')
      .select('id, gum_piece_id, user_id, role, status, invited_at, responded_at')
      .eq('gum_piece_id', id),
  ])

  if (pieceResult.error) throw new Error(pieceResult.error.message)
  if (!pieceResult.data) return null

  const allMemberRows = (memberResult.data ?? []) as GumPieceMember[]
  const myMember = allMemberRows.find((m) => m.user_id === userId) ?? null

  // Authorization: must be a member
  if (!myMember) return null

  // Fetch user profiles for all members
  const memberUserIds = allMemberRows.map((m) => m.user_id)
  const { data: userRows } = await supabase
    .from('users')
    .select('id, display_name, username, avatar_url')
    .in('id', memberUserIds)

  const profileById = new Map(
    (userRows ?? []).map((u) => [u.id as string, u as { id: string; display_name: string; username: string; avatar_url: string | null }]),
  )

  const members: GumPieceMember[] = allMemberRows.map((m) => {
    const profile = profileById.get(m.user_id)
    return {
      ...m,
      display_name: profile?.display_name,
      username: profile?.username,
      avatar_url: profile?.avatar_url,
    }
  })

  const myMemberEnriched = members.find((m) => m.user_id === userId) ?? null

  return {
    piece: pieceResult.data as unknown as PieceDetailRow,
    members,
    myMember: myMemberEnriched,
  }
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

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<CategorySlug | null>(null)
  const [editPlannedDate, setEditPlannedDate] = useState('')
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false)

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
        callback: () => {
          debouncedInvalidateQueries(queryClient, queryKey)
          invalidateGumPieces(userId, queryClient)
        },
      },
      {
        event: '*',
        table: 'gum_piece_members',
        filter: `gum_piece_id=eq.${id}`,
        callback: () => {
          debouncedInvalidateQueries(queryClient, queryKey)
          invalidateGumPieces(userId, queryClient)
        },
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
  const members = useMemo(() => pieceData?.members ?? [], [pieceData?.members])
  const myMember = pieceData?.myMember ?? null

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

  // Seed edit form when entering edit mode
  useEffect(() => {
    if (!isEditing || !piece) return
    setEditTitle(piece.title)
    setEditCategory((piece.category as CategorySlug) ?? null)
    setEditPlannedDate(piece.planned_date ?? '')
  }, [isEditing, piece])

  // Auto-suggest category as title changes in edit mode
  useEffect(() => {
    if (!isEditing || !piece) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === piece.title) return
    setIsSuggestingCategory(true)
    const t = window.setTimeout(() => {
      setEditCategory(categorizeTitle(trimmed))
      setIsSuggestingCategory(false)
    }, 500)
    return () => window.clearTimeout(t)
  }, [editTitle, isEditing, piece])

  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!piece) throw new Error('No piece')
      let accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Session expired')

      const currentTitle = editTitle.trim()
      const body: Record<string, unknown> = { gum_piece_id: piece.id, action: 'propose' }
      if (currentTitle !== piece.title) body.title = currentTitle
      if (editCategory && editCategory !== piece.category) body.category = editCategory
      const currentDate = editPlannedDate || null
      if (currentDate !== piece.planned_date) body.planned_date = currentDate

      let response = await fetch(`${functionsBaseUrl}/edit-gum-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
      if (response.status === 401) {
        accessToken = await getValidAccessToken(true)
        if (accessToken) {
          response = await fetch(`${functionsBaseUrl}/edit-gum-piece`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: publishableKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
          })
        }
      }

      if (!response.ok) {
        let errorCode: string | null = null
        try {
          const payload = (await response.json()) as { error?: string }
          errorCode = payload.error ?? null
        } catch { errorCode = null }
        if (errorCode === 'no_changes') throw new Error('Nothing changed — update at least one field.')
        if (errorCode === 'edit_already_pending') throw new Error('Someone already proposed a change. Accept or decline it first.')
        if (errorCode === 'title_invalid') throw new Error('Title must be 1–60 characters.')
        if (errorCode === 'planned_date_invalid') throw new Error('Date must be within the next year.')
        throw new Error(errorCode ?? 'Something went wrong — try again.')
      }
    },
    onSuccess: () => {
      setIsEditing(false)
      if (userId && id) invalidateGumPieceFlow(userId, queryClient, id)
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : 'Something went wrong — try again.')
    },
  })

  const editRespondMutation = useMutation({
    mutationFn: async (action: 'accept_edit' | 'decline_edit') => {
      if (!piece) throw new Error('No piece')
      let accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Session expired')

      let response = await callEditFunction(piece.id, action, accessToken)
      if (response.status === 401) {
        accessToken = await getValidAccessToken(true)
        if (accessToken) response = await callEditFunction(piece.id, action, accessToken)
      }

      if (!response.ok) {
        let errorCode: string | null = null
        try {
          const payload = (await response.json()) as { error?: string }
          errorCode = payload.error ?? null
        } catch {
          errorCode = null
        }
        throw new Error(errorCode ?? 'Something went wrong - try again.')
      }
    },
    onSuccess: () => {
      if (userId && id) {
        invalidateGumPieceFlow(userId, queryClient, id)
      }
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : 'Something went wrong - try again.')
    },
  })

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

  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id !== userId),
    [members, userId],
  )

  const statusLine = useMemo(() => {
    if (!piece || !userId) return ''
    if (piece.status === 'placeholder') {
      const pendingCount = members.filter((m) => m.role === 'invitee' && m.status === 'pending').length
      return pendingCount === 1 ? 'Waiting for 1 person to accept' : `Waiting for ${pendingCount} people to accept`
    }
    if (piece.status === 'active') return `Active · ${formatDistanceToNow(new Date(piece.expires_at), { addSuffix: false })} left`
    if (piece.status === 'turned_down') return 'Turned down'
    if (piece.status === 'expired') return 'Expired'
    return 'Confirmed'
  }, [members, piece, userId])

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

  const pendingFillClass = useMemo(() => {
    const cat = piece?.pending_edit?.category
      ? toCategorySlug(piece.pending_edit.category)
      : category
    if (cat === 'intimate') return 'bg-intimate'
    if (cat === 'active') return 'bg-active'
    if (cat === 'playful') return 'bg-playful'
    if (cat === 'explore') return 'bg-explore'
    if (cat === 'recharge') return 'bg-recharge'
    if (cat === 'savor') return 'bg-savor'
    return 'bg-support'
  }, [piece?.pending_edit?.category, category])

  const busyAction = respondMutation.isPending
    ? (respondMutation.variables as 'accept' | 'turn_down' | null)
    : null

  if (!id) return <Navigate to="/home" replace />

  if (loading) {
    return <FullScreenSpinner />
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

  const isInviteePending = myMember?.role === 'invitee' && myMember?.status === 'pending'
  const isCreator = myMember?.role === 'creator'
  const isAcceptedMember = myMember?.status === 'accepted'
  const canAccept = (piece.status === 'placeholder' || piece.status === 'active') && isInviteePending
  const canCancelPlaceholder = piece.status === 'placeholder' && isCreator
  const canTurnDownActive = piece.status === 'active' && isAcceptedMember
  const readOnly = ['confirmed', 'expired', 'turned_down'].includes(piece.status)

  // Edit / proposal state
  const pendingEdit = piece.pending_edit ?? null
  const canEditPlaceholder = piece.status === 'placeholder' && isCreator
  const canProposeEdit = piece.status === 'active' && isAcceptedMember && !pendingEdit
  const hasPendingEdit = piece.status === 'active' && pendingEdit !== null
  const isPendingEditProposer = hasPendingEdit && pendingEdit?.proposed_by === userId
  const canRespondToEdit = hasPendingEdit && !isPendingEditProposer && isAcceptedMember
  const editBusyAction = editRespondMutation.isPending
    ? (editRespondMutation.variables as 'accept_edit' | 'decline_edit' | null)
    : null

  // Find proposer display name
  const proposerMember = hasPendingEdit
    ? members.find((m) => m.user_id === pendingEdit?.proposed_by)
    : null
  const proposerName = proposerMember?.display_name ?? 'Someone'

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  return (
    <main className={pageShellScroll}>
      <div className="relative mb-2 flex items-center">
        <BackHeader onBack={handleBack} />
        {(canEditPlaceholder || canProposeEdit || isEditing) ? (
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="absolute right-0 inline-flex min-h-11 min-w-11 items-center justify-center text-text-3 hover:text-text-2"
            aria-label={isEditing ? 'Cancel edit' : canEditPlaceholder ? 'Edit plan' : 'Suggest a change'}
          >
            {isEditing ? <X size={18} strokeWidth={1.75} /> : <Pencil size={18} strokeWidth={1.75} />}
          </button>
        ) : null}
      </div>

      <div className="flex justify-center">
        <GumBlob category={isEditing && editCategory ? editCategory : category} size={136} />
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-4">
          {piece.status === 'active' ? (
            <p className="text-center text-xs text-text-3">Others will need to accept your changes.</p>
          ) : null}
          <div className="rounded-md border border-white/10 bg-surface-2 p-3">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="what do you want to do together?"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-3"
              autoFocus
            />
            <p className="mt-2 text-right text-xs text-text-3">{editTitle.length} / 60</p>
          </div>
          {editTitle.trim() ? (
            <div className={`transition-opacity ${isSuggestingCategory ? 'opacity-70' : 'opacity-100'}`}>
              <CategoryPicker selectedCategory={editCategory} onSelect={setEditCategory} />
            </div>
          ) : null}
          <div>
            <div className="flex items-baseline gap-2">
              <label htmlFor="edit-planned-date" className="text-xs text-text-3">by when?</label>
              <span className="text-xs text-text-3 opacity-60">optional</span>
            </div>
            <input
              id="edit-planned-date"
              type="date"
              value={editPlannedDate}
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
              onChange={(e) => setEditPlannedDate(e.target.value)}
              className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20 [color-scheme:dark]"
            />
            {editPlannedDate ? (
              <button
                type="button"
                onClick={() => setEditPlannedDate('')}
                className="mt-1 text-xs text-text-3 underline underline-offset-2"
              >
                Clear date
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-center font-display text-3xl text-text">{piece.title}</h1>
          <div className="mt-3 flex justify-center">
            <CategoryChip category={category} size="md" />
          </div>

          {otherMembers.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm text-text-2">with</span>
              {otherMembers.map((member) => (
                <span key={member.user_id} className="flex items-center gap-1.5">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.display_name ?? ''}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs text-text-2">
                      {(member.display_name ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {member.username ? (
                    <Link
                      to={`/profile/${member.username}`}
                      className="text-sm font-medium text-text underline underline-offset-2"
                    >
                      {member.display_name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-text">{member.display_name}</span>
                  )}
                  {member.role === 'invitee' && member.status !== 'accepted' ? (
                    <span className={`text-xs ${member.status === 'declined' ? 'text-playful' : 'text-text-3'}`}>
                      ({member.status})
                    </span>
                  ) : null}
                </span>
              ))}
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
        </>
      )}

      {/* Pending edit proposal banner */}
      {hasPendingEdit && pendingEdit ? (
        <div
          className="mt-5 overflow-hidden rounded-xl bg-surface"
          style={canRespondToEdit
            ? { border: `1px solid ${CATEGORIES[category]?.color_hex ?? '#ffffff'}66` }
            : { border: '1px solid rgba(255,255,255,0.1)' }
          }
        >
          {/* Category-colored top strip */}
          <div className={`h-0.5 w-full ${fillClass}`} />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Pencil size={13} strokeWidth={2} className="shrink-0 text-text-3" />
              <p className="text-sm font-medium text-text">
                {isPendingEditProposer ? 'You proposed a change' : `${proposerName} wants to change this plan`}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {pendingEdit.title !== undefined ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-text-3">title</span>
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-text-3 line-through">{piece.title}</span>
                  <span className="text-text-3">→</span>
                  <span className={`rounded px-2 py-0.5 ${pendingFillClass} bg-opacity-20 text-text`}>{pendingEdit.title}</span>
                </div>
              ) : null}
              {pendingEdit.category !== undefined ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-text-3">vibe</span>
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-text-3 line-through">{piece.category}</span>
                  <span className="text-text-3">→</span>
                  <span className={`rounded px-2 py-0.5 ${pendingFillClass} bg-opacity-20 text-text`}>{pendingEdit.category}</span>
                </div>
              ) : null}
              {pendingEdit.planned_date !== undefined ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-text-3">date</span>
                  {piece.planned_date ? (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-text-3 line-through">
                      {format(new Date(piece.planned_date + 'T00:00:00Z'), 'MMM d')}
                    </span>
                  ) : (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-text-3 line-through">none</span>
                  )}
                  <span className="text-text-3">→</span>
                  {pendingEdit.planned_date ? (
                    <span className={`rounded px-2 py-0.5 ${pendingFillClass} bg-opacity-20 text-text`}>
                      {format(new Date(pendingEdit.planned_date + 'T00:00:00Z'), 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-text-3 italic">cleared</span>
                  )}
                </div>
              ) : null}
            </div>

            {isPendingEditProposer ? (
              <p className="mt-3 animate-pulse text-xs text-text-3">waiting for others to accept…</p>
            ) : null}

            {canRespondToEdit ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => editRespondMutation.mutate('accept_edit')}
                  disabled={editBusyAction !== null}
                  className={`btn-primary flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${fillClass}`}
                >
                  {editBusyAction === 'accept_edit' ? 'Accepting…' : 'Accept change'}
                </button>
                <button
                  type="button"
                  onClick={() => editRespondMutation.mutate('decline_edit')}
                  disabled={editBusyAction !== null}
                  className="flex-1 rounded-full bg-surface-2 px-4 py-2.5 text-sm font-medium text-text-2 disabled:opacity-50"
                >
                  {editBusyAction === 'decline_edit' ? 'Declining…' : 'Decline'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="mt-10 space-y-3 pb-24">
        {isEditing ? (
          <>
            <button
              type="button"
              disabled={!editTitle.trim() || proposeMutation.isPending}
              onClick={() => proposeMutation.mutate()}
              className="btn-primary w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {proposeMutation.isPending
                ? piece.status === 'active' ? 'Proposing...' : 'Saving...'
                : piece.status === 'active' ? 'Propose change' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
            >
              Cancel
            </button>
          </>
        ) : null}

        {!isEditing && !hasPendingEdit && canAccept ? (
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

        {!isEditing && !hasPendingEdit && canCancelPlaceholder ? (
          <button
            type="button"
            onClick={() => respondMutation.mutate('turn_down')}
            disabled={busyAction !== null}
            className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'turn_down' ? 'Cancelling...' : 'Cancel'}
          </button>
        ) : null}

        {!isEditing && !hasPendingEdit && canTurnDownActive ? (
          <>
            <button
              type="button"
              onClick={() => void navigate(`/piece/${piece.id}/confirm`)}
              className="btn-primary w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Make a memory
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
        <div className={toastFrameClass}>
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

async function callEditFunction(
  gumPieceId: string,
  action: 'accept_edit' | 'decline_edit',
  accessToken: string,
): Promise<Response> {
  return fetch(`${functionsBaseUrl}/edit-gum-piece`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ gum_piece_id: gumPieceId, action }),
  })
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
