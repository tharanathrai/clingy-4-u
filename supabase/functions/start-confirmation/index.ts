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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: authData, error: authError } = await authClient.auth.getUser()
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
    const { data: existingSession, error: existingSessionError } = await serviceClient
      .from('confirmation_sessions')
      .select(
        'id, gum_piece_id, otp_code, initiator_id, initiator_confirmed, responder_confirmed, expires_at',
      )
      .eq('gum_piece_id', gumPieceId)
      .gt('expires_at', nowIso)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle<ConfirmationSessionRow>()

    if (existingSessionError) {
      return jsonResponse(500, { error: existingSessionError.message })
    }

    if (existingSession) {
      return jsonResponse(200, {
        session_id: existingSession.id,
        otp_code: existingSession.otp_code,
        expires_at: existingSession.expires_at,
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
      .select('id, otp_code, expires_at')
      .single()

    if (createSessionError || !createdSession) {
      return jsonResponse(500, {
        error: createSessionError?.message ?? 'Failed to create confirmation session.',
      })
    }

    return jsonResponse(200, {
      session_id: createdSession.id,
      otp_code: createdSession.otp_code,
      expires_at: createdSession.expires_at,
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
