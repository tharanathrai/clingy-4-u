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
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
}

interface ConfirmationSessionRow {
  id: string
  gum_piece_id: string
  otp_code: string
  initiator_id: string
  confirmed_member_ids: string[]
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
      .select('id, status')
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

    // Authorization: caller must be an accepted member
    const { data: memberRow, error: memberError } = await serviceClient
      .from('gum_piece_members')
      .select('id, status')
      .eq('gum_piece_id', gumPieceId)
      .eq('user_id', userId)
      .maybeSingle<{ id: string; status: string }>()

    if (memberError) {
      return jsonResponse(500, { error: memberError.message })
    }
    if (!memberRow || memberRow.status !== 'accepted') {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const nowIso = new Date().toISOString()
    const existingSessionsResult = await serviceClient
      .from('confirmation_sessions')
      .select('id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at, created_at')
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
        const duplicateIds = existingSessions.slice(1).map((s) => s.id)
        const { error: dedupeError } = await serviceClient
          .from('confirmation_sessions')
          .delete()
          .in('id', duplicateIds)
        if (dedupeError) {
          return jsonResponse(500, { error: dedupeError.message })
        }
      }

      // If caller not yet in confirmed_member_ids, add them
      if (!canonicalSession.confirmed_member_ids.includes(userId)) {
        const updatedIds = [...canonicalSession.confirmed_member_ids, userId]
        const { error: updateError } = await serviceClient
          .from('confirmation_sessions')
          .update({ confirmed_member_ids: updatedIds })
          .eq('id', canonicalSession.id)
        if (updateError) {
          return jsonResponse(500, { error: updateError.message })
        }
      }

      return jsonResponse(200, {
        session_id: canonicalSession.id,
        otp_code: canonicalSession.otp_code,
        expires_at: canonicalSession.expires_at,
        initiator_id: canonicalSession.initiator_id,
        confirmed_member_ids: canonicalSession.confirmed_member_ids,
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
        confirmed_member_ids: [userId],
        expires_at: expiresAt,
      })
      .select('id, otp_code, expires_at, initiator_id, confirmed_member_ids, created_at')
      .single()

    if (createSessionError || !createdSession) {
      return jsonResponse(500, {
        error: createSessionError?.message ?? 'Failed to create confirmation session.',
      })
    }

    // Deduplicate in case of race condition
    const activeSessionsResult = await serviceClient
      .from('confirmation_sessions')
      .select('id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at, created_at')
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
      const duplicateIds = activeSessions.slice(1).map((s) => s.id)
      const { error: dedupeError } = await serviceClient
        .from('confirmation_sessions')
        .delete()
        .in('id', duplicateIds)
      if (dedupeError) {
        return jsonResponse(500, { error: dedupeError.message })
      }
    }

    // Notify other accepted members only when this user initiated the canonical session
    if (canonicalSession.initiator_id === userId) {
      const [otherMembersResult, actorResult] = await Promise.all([
        serviceClient
          .from('gum_piece_members')
          .select('user_id')
          .eq('gum_piece_id', gumPieceId)
          .eq('status', 'accepted')
          .neq('user_id', userId),
        serviceClient
          .from('users')
          .select('display_name, avatar_url')
          .eq('id', userId)
          .maybeSingle(),
      ])
      const otherMembers = otherMembersResult.data
      const actorName = actorResult.data?.display_name ?? null
      const actorAvatarUrl = actorResult.data?.avatar_url ?? null

      if ((otherMembers ?? []).length > 0) {
        await serviceClient.from('notifications').insert(
          (otherMembers as Array<{ user_id: string }>).map((m) => ({
            user_id: m.user_id,
            type: 'confirmation_started',
            reference_id: gumPieceId,
            actor_name: actorName,
            actor_avatar_url: actorAvatarUrl,
          })),
        )
      }
    }

    return jsonResponse(200, {
      session_id: canonicalSession.id,
      otp_code: canonicalSession.otp_code,
      expires_at: canonicalSession.expires_at,
      initiator_id: canonicalSession.initiator_id,
      confirmed_member_ids: canonicalSession.confirmed_member_ids,
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
