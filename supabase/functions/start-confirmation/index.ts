import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface StartConfirmationBody {
  gum_piece_id?: string
}

interface GumPieceRow {
  id: string
  creator_id: string
  recipient_id: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
}

interface ConfirmationSessionRow {
  id: string
  gum_piece_id: string
  otp_code: string
  initiator_id: string
  initiator_confirmed: boolean
  responder_confirmed: boolean
  expires_at: string
  created_at: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header.' })
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return jsonResponse(401, { error: 'Missing bearer token.' })
    }

    const body = (await request.json()) as StartConfirmationBody
    const gumPieceId = body.gum_piece_id?.trim()
    if (!gumPieceId) {
      return jsonResponse(400, { error: 'gum_piece_id_required' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: authData, error: authError } = await serviceClient.auth.getUser(jwt)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: authError?.message ?? 'Unauthorized.' })
    }

    const userId = authData.user.id

    const { data: piece, error: pieceError } = await serviceClient
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, status')
      .eq('id', gumPieceId)
      .maybeSingle<GumPieceRow>()

    if (pieceError) {
      return jsonResponse(500, { error: pieceError.message })
    }

    if (!piece) {
      return jsonResponse(404, { error: 'gum_piece_not_found' })
    }

    if (piece.status !== 'active') {
      return jsonResponse(400, { error: 'invalid_status' })
    }

    if (piece.creator_id !== userId && piece.recipient_id !== userId) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const nowIso = new Date().toISOString()
    const existingSessionsResult = await serviceClient
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at, created_at',
      )
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })

    if (existingSessionsResult.error) {
      return jsonResponse(500, { error: existingSessionsResult.error.message })
    }

    const existingSessions = (existingSessionsResult.data ?? []) as ConfirmationSessionRow[]
    if (existingSessions.length > 0) {
      const canonicalSession = existingSessions[0]
      if (existingSessions.length > 1) {
        const duplicateIds = existingSessions.slice(1).map((session) => session.id)
        const { error: dedupeError } = await serviceClient
          .from('confirmation_sessions')
          .delete()
          .in('id', duplicateIds)
        if (dedupeError) {
          return jsonResponse(500, { error: dedupeError.message })
        }
      }

      return jsonResponse(200, {
        session_id: canonicalSession.id,
        otp_code: canonicalSession.otp_code,
        expires_at: canonicalSession.expires_at,
        initiator_id: canonicalSession.initiator_id,
      })
    }

    const otpCode = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: createdSession, error: createSessionError } = await serviceClient
      .from('confirmation_sessions')
      .insert({
        gum_piece_id: gumPieceId,
        otp_code: otpCode,
        initiator_id: userId,
        initiator_confirmed: true,
        responder_confirmed: false,
        expires_at: expiresAt,
      })
      .select('id, otp_code, expires_at, initiator_id, created_at')
      .single()

    if (createSessionError || !createdSession) {
      return jsonResponse(500, {
        error: createSessionError?.message ?? 'Failed to create confirmation session.',
      })
    }

    const activeSessionsResult = await serviceClient
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at, created_at',
      )
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })

    if (activeSessionsResult.error) {
      return jsonResponse(500, { error: activeSessionsResult.error.message })
    }

    const activeSessions = (activeSessionsResult.data ?? []) as ConfirmationSessionRow[]
    const canonicalSession = activeSessions[0]
    if (!canonicalSession) {
      return jsonResponse(500, { error: 'Failed to load confirmation session.' })
    }

    if (activeSessions.length > 1) {
      const duplicateIds = activeSessions.slice(1).map((session) => session.id)
      const { error: dedupeError } = await serviceClient
        .from('confirmation_sessions')
        .delete()
        .in('id', duplicateIds)
      if (dedupeError) {
        return jsonResponse(500, { error: dedupeError.message })
      }
    }

    return jsonResponse(200, {
      session_id: canonicalSession.id,
      otp_code: canonicalSession.otp_code,
      expires_at: canonicalSession.expires_at,
      initiator_id: canonicalSession.initiator_id,
    })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
