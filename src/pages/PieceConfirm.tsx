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

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

type FlowState = 'loading' | 'waiting' | 'bridge_formed' | 'expired'

export default function PieceConfirm() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [flowState, setFlowState] = useState<FlowState>('loading')
  const [piece, setPiece] = useState<GumPiece | null>(null)
  const [fallbackSession, setFallbackSession] = useState<ConfirmationSession | null>(null)
  const [bridge, setBridge] = useState<Bridge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState('Someone')
  const [recipientName, setRecipientName] = useState('Someone')

  const handleSessionDeleted = useCallback(async () => {
    if (!id) {
      return
    }

    const bridgeRow = await loadBridgeForPiece(id)
    if (bridgeRow) {
      setBridge(bridgeRow)
      setFlowState('bridge_formed')
      return
    }

    setFlowState('expired')
  }, [id])

  const {
    session: liveSession,
    loading: sessionLoading,
    error: sessionError,
  } = useConfirmationSession({
    gumPieceId: piece?.id ?? null,
    onBridgeFormed: () => {
      void handleSessionDeleted()
    },
  })

  const activeSession = liveSession ?? fallbackSession
  const isInitiator = user ? activeSession?.initiator_id === user.id : false
  const partnerName = useMemo(() => {
    if (!user || !piece) {
      return 'your partner'
    }
    return user.id === piece.creator_id ? recipientName : creatorName
  }, [creatorName, piece, recipientName, user])
  const currentUserName = useMemo(() => {
    if (!user || !piece) {
      return 'You'
    }
    return user.id === piece.creator_id ? creatorName : recipientName
  }, [creatorName, piece, recipientName, user])
  const category = useMemo(() => toCategorySlug(piece?.category), [piece?.category])

  const loadData = useCallback(async () => {
    if (!id || !user) {
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

    if (pieceRow.creator_id !== user.id && pieceRow.recipient_id !== user.id) {
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
  }, [id, user])

  useEffect(() => {
    if (authLoading || !user || !id) {
      return
    }
    void loadData()
  }, [authLoading, id, loadData, user])

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
    return <UnwrapCeremony bridge={bridge} onComplete={() => navigate('/home')} />
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
          <p className="text-sm text-text">The window closed. Try again.</p>
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="mt-4 w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            Start over
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
            onBridgeFormed={(nextBridge) => {
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
      setError?.(existingError.message)
      setFlowState?.('expired')
      return
    }

    if (existingSession) {
      setFallbackSession?.(existingSession as ConfirmationSession)
      setFlowState?.('waiting')
      return
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    setError?.('Authentication expired. Please sign in again.')
    setFlowState?.('expired')
    return
  }

  const response = await fetch(`${functionsBaseUrl}/start-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      gum_piece_id: gumPieceId,
    }),
  })
  const payload = (await response.json().catch(() => null)) as
    | {
        session_id?: string
        otp_code?: string
        expires_at?: string
      }
    | null

  if (!response.ok || !payload?.session_id || !payload.otp_code || !payload.expires_at) {
    setError?.('Could not start confirmation right now.')
    setFlowState?.('expired')
    return
  }

  const { data: createdSession, error: createdError } = await supabase
    .from('confirmation_sessions')
    .select(
      'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at, created_at',
    )
    .eq('id', payload.session_id)
    .maybeSingle()

  if (createdError) {
    setError?.(createdError.message)
    setFlowState?.('expired')
    return
  }

  if (createdSession) {
    setFallbackSession?.(createdSession as ConfirmationSession)
    setFlowState?.('waiting')
    return
  }

  setFallbackSession?.({
    id: payload.session_id,
    gum_piece_id: gumPieceId,
    otp_code: payload.otp_code,
    initiator_id: '',
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
