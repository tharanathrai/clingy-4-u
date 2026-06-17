import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

export interface ConfirmationSession {
  id: string
  gum_piece_id: string
  otp_code: string
  initiator_id: string
  confirmed_member_ids: string[]
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
      'id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at, created_at',
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
  const bridgeFormedFiredRef = useRef(false)
  const onBridgeFormedRef = useRef(onBridgeFormed)

  useEffect(() => {
    onBridgeFormedRef.current = onBridgeFormed
  }, [onBridgeFormed])

  useEffect(() => {
    hadSessionRef.current = false
    bridgeFormedFiredRef.current = false
  }, [gumPieceId])

  const qk = queryKeys.confirmationSession(gumPieceId)

  const { data, isPending, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchConfirmationSession(gumPieceId!),
    enabled: Boolean(gumPieceId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (data) {
      hadSessionRef.current = true
    }
  }, [data])

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
          if (!hadSessionRef.current || bridgeFormedFiredRef.current) {
            queryClient.setQueryData<ConfirmationSession | null>(qk, null)
            return
          }
          bridgeFormedFiredRef.current = true
          hadSessionRef.current = false
          queryClient.setQueryData<ConfirmationSession | null>(qk, null)
          onBridgeFormedRef.current?.()
        },
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gumPieceId, queryClient])

  return {
    session: data ?? null,
    loading: isPending,
    error: error instanceof Error ? error.message : null,
  }
}
