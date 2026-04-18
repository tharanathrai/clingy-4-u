import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'

export interface ConfirmationSession {
  id: string
  gum_piece_id: string
  otp_code: string
  initiator_id: string
  initiator_confirmed: boolean
  responder_confirmed: boolean
  expires_at: string
  created_at: string
}

interface UseConfirmationSessionParams {
  gumPieceId: string | null
  onBridgeFormed?: () => void
}

interface UseConfirmationSessionResult {
  session: ConfirmationSession | null
  loading: boolean
  error: string | null
}

export function useConfirmationSession({
  gumPieceId,
  onBridgeFormed,
}: UseConfirmationSessionParams): UseConfirmationSessionResult {
  const [session, setSession] = useState<ConfirmationSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hadSessionRef = useRef(false)
  const onBridgeFormedRef = useRef(onBridgeFormed)

  useEffect(() => {
    onBridgeFormedRef.current = onBridgeFormed
  }, [onBridgeFormed])

  const loadSession = useCallback(async () => {
    if (!gumPieceId) {
      setSession(null)
      setError(null)
      setLoading(false)
      hadSessionRef.current = false
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at, created_at',
      )
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setSession(null)
      setLoading(false)
      return
    }

    const nextSession = (data ?? null) as ConfirmationSession | null
    setSession(nextSession)
    if (nextSession) {
      hadSessionRef.current = true
    }
    if (!nextSession && hadSessionRef.current) {
      onBridgeFormedRef.current?.()
    }
    setLoading(false)
  }, [gumPieceId])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!gumPieceId) {
      return
    }

    const channel = supabase
      .channel(`confirmation-session-${gumPieceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'confirmation_sessions',
          filter: `gum_piece_id=eq.${gumPieceId}`,
        },
        (payload) => {
          setSession(payload.new as ConfirmationSession)
          hadSessionRef.current = true
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'confirmation_sessions',
          filter: `gum_piece_id=eq.${gumPieceId}`,
        },
        (payload) => {
          setSession(payload.new as ConfirmationSession)
          hadSessionRef.current = true
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'confirmation_sessions',
          filter: `gum_piece_id=eq.${gumPieceId}`,
        },
        () => {
          setSession(null)
          hadSessionRef.current = false
          onBridgeFormedRef.current?.()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gumPieceId])

  return {
    session,
    loading,
    error,
  }
}
