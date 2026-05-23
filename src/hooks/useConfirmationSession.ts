import { useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

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

async function fetchConfirmationSession(gumPieceId: string): Promise<ConfirmationSession | null> {
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
    throw new Error(queryError.message)
  }

  return (data ?? null) as ConfirmationSession | null
}

export function useConfirmationSession({
  gumPieceId,
  onBridgeFormed,
}: UseConfirmationSessionParams): UseConfirmationSessionResult {
  const queryClient = useQueryClient()
  const hadSessionRef = useRef(false)
  const onBridgeFormedRef = useRef(onBridgeFormed)

  useEffect(() => {
    onBridgeFormedRef.current = onBridgeFormed
  }, [onBridgeFormed])

  const qk = queryKeys.confirmationSession(gumPieceId)

  const { data, isLoading, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchConfirmationSession(gumPieceId!),
    enabled: Boolean(gumPieceId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // Track session presence to detect bridge formation (session deleted)
  const handleSessionData = useCallback(
    (session: ConfirmationSession | null) => {
      if (session) {
        hadSessionRef.current = true
      } else if (hadSessionRef.current) {
        onBridgeFormedRef.current?.()
      }
    },
    [],
  )

  useEffect(() => {
    handleSessionData(data ?? null)
  }, [data, handleSessionData])

  useEffect(() => {
    if (!gumPieceId) return
    const filter = `gum_piece_id=eq.${gumPieceId}`
    return subscribePostgresChannel(`confirmation-session-rt-${gumPieceId}`, [
      {
        event: 'INSERT',
        table: 'confirmation_sessions',
        filter,
        callback: (payload) => {
          const session = payload.new as ConfirmationSession
          hadSessionRef.current = true
          queryClient.setQueryData<ConfirmationSession | null>(qk, session)
        },
      },
      {
        event: 'UPDATE',
        table: 'confirmation_sessions',
        filter,
        callback: (payload) => {
          const session = payload.new as ConfirmationSession
          hadSessionRef.current = true
          queryClient.setQueryData<ConfirmationSession | null>(qk, session)
        },
      },
      {
        event: 'DELETE',
        table: 'confirmation_sessions',
        filter,
        callback: () => {
          queryClient.setQueryData<ConfirmationSession | null>(qk, null)
          hadSessionRef.current = false
          onBridgeFormedRef.current?.()
        },
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gumPieceId, queryClient])

  return {
    session: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  }
}
