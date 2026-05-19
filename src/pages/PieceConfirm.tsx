import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { OTPDisplay } from '../components/confirmation/OTPDisplay.tsx'
import { UnwrapCeremony } from '../components/confirmation/UnwrapCeremony.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import {
  type ConfirmationSession,
  useConfirmationSession,
} from '../hooks/useConfirmationSession.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import type { Bridge } from '../types/index.ts'

interface GumPiece {
  id: string
  creator_id: string
  recipient_id: string
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
  const [flowState, setFlowState] = useState<FlowState>('loading')
  const [piece, setPiece] = useState<GumPiece | null>(null)
  const [fallbackSession, setFallbackSession] = useState<ConfirmationSession | null>(null)
  const [bridge, setBridge] = useState<Bridge | null>(null)
  const [draftPostId, setDraftPostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState('Unknown user')
  const [recipientName, setRecipientName] = useState('Unknown user')

  const handleSessionDeleted = useCallback(async () => {
    if (!id || !userId) {
      return
    }

    const bridgeRow = await loadBridgeForPiece(id)
    if (bridgeRow) {
      const nextDraftPostId = await loadDraftPostIdForBridge(bridgeRow.id, userId)
      setDraftPostId(nextDraftPostId)
      setBridge(bridgeRow)
      setFlowState('bridge_formed')
      return
    }

    setFlowState('expired')
  }, [id, userId])

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
  const isInitiator = user ? activeSession?.initiator_id === user.id : false
  const partnerName = useMemo(() => {
    if (!userId || !piece) {
      return 'your partner'
    }
    return userId === piece.creator_id ? recipientName : creatorName
  }, [creatorName, piece, recipientName, userId])
  const currentUserName = useMemo(() => {
    if (!userId || !piece) {
      return 'You'
    }
    return userId === piece.creator_id ? creatorName : recipientName
  }, [creatorName, piece, recipientName, userId])
  const category = useMemo(() => toCategorySlug(piece?.category), [piece?.category])

  const loadData = useCallback(async () => {
    if (!id || !userId) {
      return
    }

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

    if (pieceRow.creator_id !== userId && pieceRow.recipient_id !== userId) {
      setError('You do not have access to this plan.')
      return
    }

    setPiece(pieceRow as GumPiece)

    const { data: usersRows } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', [pieceRow.creator_id, pieceRow.recipient_id])

    const creator = usersRows?.find((row) => row.id === pieceRow.creator_id)
    const recipient = usersRows?.find((row) => row.id === pieceRow.recipient_id)
    if (creator?.display_name) {
      setCreatorName(creator.display_name)
    }
    if (recipient?.display_name) {
      setRecipientName(recipient.display_name)
    }

    await startOrJoinSession(
      id,
      false,
      setFallbackSession,
      setFlowState,
      setError,
    )
  }, [id, userId])

  useEffect(() => {
    if (authLoading || !userId || !id) {
      return
    }
    void loadData()
  }, [authLoading, id, loadData, userId])

  useEffect(() => {
    if (sessionError) {
      setError(sessionError)
    }
  }, [sessionError])

  useEffect(() => {
    if (liveSession) {
      setFlowState('waiting')
    }
  }, [liveSession])

  useEffect(() => {
    if (!id || flowState !== 'waiting' || !activeSession) {
      return
    }

    let cancelled = false

    const checkBridgeFallback = async () => {
      const bridgeRow = await loadBridgeForPiece(id)
      if (!cancelled && bridgeRow) {
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
  }, [activeSession, flowState, id])

  const handleStartOver = useCallback(async () => {
    if (!id) {
      return
    }
    await startOrJoinSession(id, true, setFallbackSession, setFlowState, setError)
  }, [id])

  if (!id) {
    return <Navigate to="/home" replace />
  }

  if (authLoading || flowState === 'loading' || sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Preparing confirmation...</p>
      </main>
    )
  }

  if (!user || !piece) {
    return <Navigate to="/home" replace />
  }

  if (flowState === 'bridge_formed' && bridge) {
    return (
      <UnwrapCeremony
        bridge={bridge}
        draftPostId={draftPostId}
        onComplete={(toast) =>
          navigate('/home', {
            replace: true,
            state: toast ? { toast } : undefined,
          })
        }
      />
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-8 pt-6 text-text">
      {activeSession ? null : (
        <div className="mb-6">
          <Link to={`/piece/${id}`} className="inline-flex items-center gap-2 text-sm text-text-2">
            <ArrowLeft size={18} strokeWidth={1.75} />
            back
          </Link>
        </div>
      )}

      <h1 className="mt-2 text-center font-display text-3xl text-text">
        {partnerName}&apos;s plan
      </h1>
      <div className="mt-3 flex justify-center">
        <CategoryChip category={category} size="md" />
      </div>
      <p className="mt-3 text-center text-base text-text">{piece.title}</p>

      {error ? <p className="mt-6 text-center text-sm text-playful">{error}</p> : null}

      {flowState === 'expired' ? (
        <section className="mt-8 rounded-lg bg-surface p-6 text-center">
          <p className="text-sm text-text">The window closed.</p>
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="mt-4 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            Try again
          </button>
        </section>
      ) : null}

      {activeSession && flowState === 'waiting' ? (
        <div className="mt-6">
          <OTPDisplay
            code={activeSession.otp_code}
            expiresAt={activeSession.expires_at}
            confirmed={{
              initiator: activeSession.initiator_confirmed,
              responder: activeSession.responder_confirmed,
            }}
            isInitiator={Boolean(isInitiator)}
            sessionId={activeSession.id}
            partnerName={partnerName}
            currentUserName={currentUserName}
            onBridgeFormed={(nextBridge, nextDraftPostId) => {
              setDraftPostId(nextDraftPostId)
              setBridge(nextBridge)
              setFlowState('bridge_formed')
            }}
            onSessionExpired={() => {
              setFlowState('expired')
            }}
            onStartOver={handleStartOver}
          />
        </div>
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
    const { data: existingSession, error: existingError } = await supabase
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at, created_at',
      )
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      // If client-side RLS blocks this query, the edge function can still
      // return an active session, so continue instead of hard-failing.
    }

    if (existingSession) {
      setFallbackSession?.(existingSession as ConfirmationSession)
      setFlowState?.('waiting')
      return
    }
  }

  const { data, error } = await supabase.functions.invoke('start-confirmation', {
    body: {
      gum_piece_id: gumPieceId,
    },
  })
  const payload = (data ?? null) as
    | {
        session_id?: string
        otp_code?: string
        expires_at?: string
        initiator_id?: string
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
    initiator_confirmed: false,
    responder_confirmed: false,
    expires_at: payload.expires_at,
    created_at: nowIso,
  })
  setFlowState?.('waiting')
}

async function loadBridgeForPiece(gumPieceId: string): Promise<Bridge | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data } = await supabase
      .from('bridges')
      .select('*')
      .eq('gum_piece_id', gumPieceId)
      .maybeSingle()

    if (data) {
      return data as Bridge
    }

    await sleep(250)
  }

  return null
}

async function loadDraftPostIdForBridge(
  bridgeId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('posts')
    .select('id')
    .eq('bridge_id', bridgeId)
    .eq('author_id', userId)
    .eq('is_public', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  return data?.id ?? null
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
