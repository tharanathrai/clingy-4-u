import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface SubmitConfirmationBody {
  session_id?: string
  otp_code?: string
}

interface ConfirmationSessionRow {
  id: string
  gum_piece_id: string
  otp_code: string
  initiator_id: string
  initiator_confirmed: boolean
  responder_confirmed: boolean
  expires_at: string
}

interface GumPieceRow {
  id: string
  creator_id: string
  recipient_id: string
  title: string
  category: string
  color_hex: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
}

interface BridgeRow {
  id: string
  activity_title: string
  category: string
  color_hex: string
  formed_at: string
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

    const body = (await request.json()) as SubmitConfirmationBody
    const sessionId = body.session_id?.trim()
    const otpCode = body.otp_code?.trim()

    if (!sessionId) {
      return jsonResponse(400, { error: 'session_id_required' })
    }
    if (!otpCode) {
      return jsonResponse(400, { error: 'otp_code_required' })
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
    const nowIso = new Date().toISOString()

    const { data: session, error: sessionError } = await serviceClient
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at',
      )
      .eq('id', sessionId)
      .maybeSingle<ConfirmationSessionRow>()

    if (sessionError) {
      return jsonResponse(500, { error: sessionError.message })
    }
    if (!session) {
      return jsonResponse(404, { error: 'session_not_found' })
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return jsonResponse(400, { error: 'session_expired' })
    }
    if (session.otp_code !== otpCode) {
      return jsonResponse(400, { error: 'otp_mismatch' })
    }

    const { data: piece, error: pieceError } = await serviceClient
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, title, category, color_hex, status')
      .eq('id', session.gum_piece_id)
      .maybeSingle<GumPieceRow>()

    if (pieceError) {
      return jsonResponse(500, { error: pieceError.message })
    }
    if (!piece) {
      return jsonResponse(404, { error: 'gum_piece_not_found' })
    }
    if (piece.status !== 'active' && piece.status !== 'confirmed') {
      return jsonResponse(400, { error: 'invalid_status' })
    }
    if (piece.creator_id !== userId && piece.recipient_id !== userId) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const isInitiator = userId === session.initiator_id
    if (!isInitiator && userId !== piece.creator_id && userId !== piece.recipient_id) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const updatePayload: {
      initiator_confirmed?: boolean
      responder_confirmed?: boolean
    } = {}
    if (isInitiator) {
      updatePayload.initiator_confirmed = true
    } else {
      updatePayload.responder_confirmed = true
    }

    const { data: updatedSession, error: updateSessionError } = await serviceClient
      .from('confirmation_sessions')
      .update(updatePayload)
      .eq('id', session.id)
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at',
      )
      .single<ConfirmationSessionRow>()

    if (updateSessionError || !updatedSession) {
      return jsonResponse(500, {
        error: updateSessionError?.message ?? 'Failed to update confirmation state.',
      })
    }

    const bridgeShouldForm =
      updatedSession.initiator_confirmed &&
      updatedSession.responder_confirmed &&
      new Date(updatedSession.expires_at).getTime() > Date.now()

    if (!bridgeShouldForm) {
      return jsonResponse(200, { success: true, bridge_formed: false })
    }

    const sortedPair = [piece.creator_id, piece.recipient_id].sort()
    const userAId = sortedPair[0]
    const userBId = sortedPair[1]

    const { data: existingBridge, error: existingBridgeError } = await serviceClient
      .from('bridges')
      .select('id, activity_title, category, color_hex, formed_at')
      .eq('gum_piece_id', piece.id)
      .maybeSingle<BridgeRow>()

    if (existingBridgeError) {
      return jsonResponse(500, { error: existingBridgeError.message })
    }

    let bridge = existingBridge

    if (!bridge) {
      const { data: updatedPiece, error: updatePieceError } = await serviceClient
        .from('gum_pieces')
        .update({
          status: 'confirmed',
          confirmed_at: nowIso,
        })
        .eq('id', piece.id)
        .select('id')
        .single()

      if (updatePieceError || !updatedPiece) {
        return jsonResponse(500, {
          error: updatePieceError?.message ?? 'Failed to update gum piece.',
        })
      }

      const { data: createdBridge, error: createBridgeError } = await serviceClient
        .from('bridges')
        .insert({
          gum_piece_id: piece.id,
          user_a_id: userAId,
          user_b_id: userBId,
          category: piece.category,
          color_hex: piece.color_hex,
          activity_title: piece.title,
          formed_at: nowIso,
        })
        .select('id, activity_title, category, color_hex, formed_at')
        .single<BridgeRow>()

      if (createBridgeError || !createdBridge) {
        const retry = await serviceClient
          .from('bridges')
          .select('id, activity_title, category, color_hex, formed_at')
          .eq('gum_piece_id', piece.id)
          .maybeSingle<BridgeRow>()
        if (retry.error || !retry.data) {
          return jsonResponse(500, {
            error:
              createBridgeError?.message ??
              retry.error?.message ??
              'Failed to create bridge.',
          })
        }
        bridge = retry.data
      } else {
        bridge = createdBridge
      }

      const bridgeId = bridge.id
      const notifications = [
        {
          user_id: piece.creator_id,
          type: 'bridge_formed',
          reference_id: bridgeId,
          read: false,
        },
        {
          user_id: piece.recipient_id,
          type: 'bridge_formed',
          reference_id: bridgeId,
          read: false,
        },
      ]

      const { error: notificationError } = await serviceClient
        .from('notifications')
        .insert(notifications)
      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }
    }

    const { error: deleteSessionError } = await serviceClient
      .from('confirmation_sessions')
      .delete()
      .eq('id', session.id)
    if (deleteSessionError) {
      return jsonResponse(500, { error: deleteSessionError.message })
    }

    return jsonResponse(200, {
      success: true,
      bridge_formed: true,
      bridge,
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
