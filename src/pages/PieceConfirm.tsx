import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { pageShellCentered, pageShellScroll } from '../components/layout/pageShell.ts'
import { OTPDisplay, type AcceptedMember } from '../components/confirmation/OTPDisplay.tsx'
import { BridgeFormation } from '../components/confirmation/BridgeFormation.tsx'
import { iconButtonClassName } from '../lib/iconButton.ts'
import { useAuth } from '../hooks/useAuth.ts'
import {
  type ConfirmationSession,
  useConfirmationSession,
} from '../hooks/useConfirmationSession.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { buildDraftPostBody } from '../lib/draftPostBody.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { supabase } from '../lib/supabase.ts'
import type { Bridge } from '../types/index.ts'

interface GumPiece {
  id: string
  creator_id: string
  recipient_id: string | null
  title: string
  category: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
}

type FlowState = 'loading' | 'waiting' | 'bridge_formed' | 'expired'

export default function PieceConfirm() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [flowState, setFlowState] = useState<FlowState>('loading')
  const [piece, setPiece] = useState<GumPiece | null>(null)
  const [fallbackSession, setFallbackSession] = useState<ConfirmationSession | null>(null)
  const [bridge, setBridge] = useState<Bridge | null>(null)
  const [draftPostId, setDraftPostId] = useState<string | null>(null)
  const [suggestedPostBody, setSuggestedPostBody] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acceptedMembers, setAcceptedMembers] = useState<AcceptedMember[]>([])

  const handleSessionDeleted = useCallback(async () => {
    if (!id || !userId) return

    const bridgeRow = await loadBridgeForPiece(id, userId)
    if (bridgeRow) {
      const draftPost = await loadDraftPostForBridge(bridgeRow.id, userId)
      setDraftPostId(draftPost?.id ?? null)
      setSuggestedPostBody(
        draftPost?.body ??
          (piece
            ? buildFallbackDraftBody(acceptedMembers, userId, piece.title, piece.category)
            : null),
      )
      setBridge(bridgeRow)
      setFlowState('bridge_formed')
      return
    }

    setFlowState('expired')
  }, [acceptedMembers, id, piece, userId])

  const handleBridgeFormedFromSession = useCallback(() => {
    void handleSessionDeleted()
  }, [handleSessionDeleted])

  const {
    session: liveSession,
    loading: sessionLoading,
    error: sessionError,
  } = useConfirmationSession({
    gumPieceId: piece?.id ?? null,
    onBridgeFormed: handleBridgeFormedFromSession,
  })

  const activeSession = liveSession ?? fallbackSession

  const partnerName = useMemo(() => {
    if (!userId) return 'your partner'
    const others = acceptedMembers.filter((m) => m.id !== userId)
    if (others.length === 0) return 'the group'
    if (others.length === 1) return others[0].name
    return `${others[0].name} and ${others.length - 1} more`
  }, [acceptedMembers, userId])

  const currentUserName = useMemo(() => {
    if (!userId) return 'You'
    return acceptedMembers.find((m) => m.id === userId)?.name ?? 'You'
  }, [acceptedMembers, userId])

  const category = useMemo(() => toCategorySlug(piece?.category), [piece?.category])

  const loadData = useCallback(async () => {
    if (!id || !userId) return

    setFlowState('loading')
    setError(null)

    const { data: pieceRow, error: pieceError } = await supabase
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, title, category, status')
      .eq('id', id)
      .maybeSingle()

    if (pieceError || !pieceRow) {
      setError(pieceError?.message ?? 'Plan not found.')
      return
    }

    if (pieceRow.status !== 'active') {
      setError('This plan cannot be confirmed anymore.')
      return
    }

    // Auth check via members table
    const { data: memberRow } = await supabase
      .from('gum_piece_members')
      .select('id, status')
      .eq('gum_piece_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!memberRow || memberRow.status !== 'accepted') {
      setError('You do not have access to this plan.')
      return
    }

    setPiece(pieceRow as GumPiece)

    // Fetch all accepted members with their names
    const { data: memberRows } = await supabase
      .from('gum_piece_members')
      .select('user_id')
      .eq('gum_piece_id', id)
      .eq('status', 'accepted')

    const memberIds = (memberRows ?? []).map((m) => m.user_id as string)
    if (memberIds.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', memberIds)

      const members: AcceptedMember[] = (userRows ?? []).map((u) => ({
        id: u.id as string,
        name: (u.display_name as string) ?? 'Unknown',
        avatarUrl: (u.avatar_url as string | null) ?? undefined,
      }))
      setAcceptedMembers(members)
    }

    await startOrJoinSession(id, false, setFallbackSession, setFlowState, setError)
  }, [id, userId])

  useEffect(() => {
    if (authLoading || !userId || !id) return
    void loadData()
  }, [authLoading, id, loadData, userId])

  useEffect(() => {
    if (sessionError) setError(sessionError)
  }, [sessionError])

  useEffect(() => {
    if (liveSession && flowState !== 'bridge_formed') {
      setFlowState('waiting')
    }
  }, [flowState, liveSession])

  useEffect(() => {
    if (!id || flowState !== 'waiting' || !activeSession) return

    let cancelled = false

    const checkBridgeFallback = async () => {
      if (!userId) return
      const bridgeRow = await loadBridgeForPiece(id, userId)
      if (!cancelled && bridgeRow) {
        const draftPost = userId ? await loadDraftPostForBridge(bridgeRow.id, userId) : null
        setDraftPostId(draftPost?.id ?? null)
        setSuggestedPostBody(
          draftPost?.body ??
            (piece
              ? buildFallbackDraftBody(acceptedMembers, userId, piece.title, piece.category)
              : null),
        )
        setBridge(bridgeRow)
        setFlowState('bridge_formed')
        setFallbackSession(null)
      }
    }

    const intervalId = window.setInterval(() => {
      void checkBridgeFallback()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [acceptedMembers, activeSession, flowState, id, piece, userId])

  const handleStartOver = useCallback(async () => {
    if (!id) return
    await startOrJoinSession(id, true, setFallbackSession, setFlowState, setError)
  }, [id])

  if (!id) return <Navigate to="/home" replace />

  if (authLoading || flowState === 'loading' || sessionLoading) {
    return (
      <main className={`${pageShellCentered} px-5`}>
        <div className="skeleton h-24 w-24 rounded-full" />
        <div className="skeleton mt-6 h-8 w-48 rounded" />
        <div className="skeleton mt-3 h-4 w-32 rounded-full" />
        <div className="mt-10 skeleton h-24 w-48 rounded-xl" />
        <div className="skeleton mt-6 h-12 w-full rounded-full" />
      </main>
    )
  }

  if (!user || !piece) return <Navigate to="/home" replace />

  const handleComplete = (toast?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gumPieces(userId) })
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.pieceDetail(id, userId) })
    navigate('/home', { replace: true, state: toast ? { toast } : undefined })
  }

  if (flowState === 'bridge_formed' && bridge) {
    return (
      <BridgeFormation
        bridge={bridge}
        activityTitle={bridge.activity_title || piece.title}
        draftPostId={draftPostId}
        suggestedPostBody={suggestedPostBody}
        members={acceptedMembers}
        onComplete={handleComplete}
      />
    )
  }

  if (activeSession && flowState === 'waiting') {
    return (
      <OTPDisplay
        code={activeSession.otp_code}
        expiresAt={activeSession.expires_at}
        confirmedMemberIds={activeSession.confirmed_member_ids ?? []}
        acceptedMembers={
          acceptedMembers.length > 0
            ? acceptedMembers
            : [{ id: userId!, name: currentUserName }, { id: '__partner__', name: partnerName }]
        }
        currentUserId={userId!}
        sessionId={activeSession.id}
        category={category}
        activityTitle={piece.title}
        onBridgeFormed={(nextBridge, nextDraftPostId, nextDraftPostBody) => {
          setDraftPostId(nextDraftPostId)
          setSuggestedPostBody(
            nextDraftPostBody ??
              (piece
                ? buildFallbackDraftBody(acceptedMembers, userId!, piece.title, piece.category)
                : null),
          )
          setBridge(nextBridge)
          setFlowState('bridge_formed')
        }}
        onSessionExpired={() => setFlowState('expired')}
        onStartOver={handleStartOver}
        onNotReady={() => navigate('/home', { replace: true })}
      />
    )
  }

  return (
    <main className={pageShellScroll}>
      <div className="mb-2">
        <button
          type="button"
          onClick={() => navigate('/home', { replace: true })}
          className={iconButtonClassName}
          aria-label="Not ready"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <h1 className="mt-2 text-center font-display text-3xl text-text">{piece.title}</h1>
      <div className="mt-3 flex justify-center">
        <CategoryChip category={category} size="md" />
      </div>

      {error ? <p className="mt-6 text-center text-sm text-playful">{error}</p> : null}

      {flowState === 'expired' ? (
        <section className="mt-8 rounded-lg bg-surface p-6 text-center">
          <p className="text-sm text-text">The window closed.</p>
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="btn-primary mt-4 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            Try again
          </button>
        </section>
      ) : null}
    </main>
  )
}

async function startOrJoinSession(
  gumPieceId: string,
  forceStart = false,
  setFallbackSession?: (session: ConfirmationSession | null) => void,
  setFlowState?: (state: FlowState) => void,
  setError?: (error: string | null) => void,
) {
  const nowIso = new Date().toISOString()

  if (!forceStart) {
    const { data: existingSession } = await supabase
      .from('confirmation_sessions')
      .select('id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at, created_at')
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      setFallbackSession?.(existingSession as ConfirmationSession)
      setFlowState?.('waiting')
      return
    }
  }

  const { data, error } = await supabase.functions.invoke('start-confirmation', {
    body: { gum_piece_id: gumPieceId },
  })
  const payload = (data ?? null) as
    | {
        session_id?: string
        otp_code?: string
        expires_at?: string
        initiator_id?: string
        confirmed_member_ids?: string[]
        error?: string
      }
    | null

  if (error || !payload?.session_id || !payload.otp_code || !payload.expires_at) {
    const reason = payload?.error ?? error?.message
    if (reason === 'invalid_status') {
      setError?.('This plan can no longer be confirmed.')
    } else if (reason === 'forbidden') {
      setError?.('You do not have access to this plan.')
    } else {
      setError?.('Could not start confirmation right now.')
    }
    setFlowState?.('expired')
    return
  }

  setFallbackSession?.({
    id: payload.session_id,
    gum_piece_id: gumPieceId,
    otp_code: payload.otp_code,
    initiator_id: payload.initiator_id ?? '',
    confirmed_member_ids: payload.confirmed_member_ids ?? [],
    expires_at: payload.expires_at,
    created_at: nowIso,
  })
  setFlowState?.('waiting')
}

async function loadBridgeForPiece(gumPieceId: string, userId: string): Promise<Bridge | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Find a bridge for this piece that involves the current user
    const { data } = await supabase
      .from('bridges')
      .select('*')
      .eq('gum_piece_id', gumPieceId)
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .limit(1)
      .maybeSingle()

    if (data) return data as Bridge

    await sleep(250)
  }

  return null
}

async function loadDraftPostForBridge(
  bridgeId: string,
  userId: string,
): Promise<{ id: string; body: string } | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase
      .from('posts')
      .select('id, body')
      .eq('bridge_id', bridgeId)
      .eq('author_id', userId)
      .eq('is_public', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; body: string }>()

    if (data?.id) return data

    await sleep(250)
  }

  return null
}

function buildFallbackDraftBody(
  acceptedMembers: AcceptedMember[],
  userId: string,
  title: string,
  category: string,
): string {
  const currentUser = acceptedMembers.find((m) => m.id === userId)
  const others = acceptedMembers.filter((m) => m.id !== userId)
  const creatorName = currentUser?.name ?? 'You'
  const recipientName = others[0]?.name ?? 'someone'
  return buildDraftPostBody({ creatorName, recipientName, title, category })
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

function toCategorySlug(value?: string): CategorySlug {
  if (value && value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
}
