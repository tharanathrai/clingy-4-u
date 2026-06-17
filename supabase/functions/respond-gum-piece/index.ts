import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const GLOBAL_SLOT_LIMIT = 25

interface RespondGumPieceBody {
  gum_piece_id?: string
  action?: 'accept' | 'turn_down'
}

type GumPieceRow = {
  id: string
  creator_id: string
  title: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
  planned_date: string | null
}

type MemberRow = {
  id: string
  user_id: string
  role: 'creator' | 'invitee'
  status: 'pending' | 'accepted' | 'declined'
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

    const body = (await request.json()) as RespondGumPieceBody
    const gumPieceId = body.gum_piece_id?.trim()
    const action = body.action

    if (!gumPieceId) {
      return jsonResponse(400, { error: 'gum_piece_id_required' })
    }
    if (!action || (action !== 'accept' && action !== 'turn_down')) {
      return jsonResponse(400, { error: 'action_invalid' })
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

    // Fetch piece and caller's membership row in parallel
    const [pieceResult, memberResult] = await Promise.all([
      serviceClient
        .from('gum_pieces')
        .select('id, creator_id, title, status, planned_date')
        .eq('id', gumPieceId)
        .maybeSingle<GumPieceRow>(),
      serviceClient
        .from('gum_piece_members')
        .select('id, user_id, role, status')
        .eq('gum_piece_id', gumPieceId)
        .eq('user_id', userId)
        .maybeSingle<MemberRow>(),
    ])

    if (pieceResult.error) {
      return jsonResponse(500, { error: pieceResult.error.message })
    }
    if (!pieceResult.data) {
      return jsonResponse(404, { error: 'gum_piece_not_found' })
    }
    if (memberResult.error) {
      return jsonResponse(500, { error: memberResult.error.message })
    }
    if (!memberResult.data) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const piece = pieceResult.data
    const myMember = memberResult.data

    if (action === 'accept') {
      if (piece.status !== 'placeholder' && piece.status !== 'active') {
        return jsonResponse(400, { error: 'invalid_status' })
      }
      if (myMember.role !== 'invitee') {
        return jsonResponse(403, { error: 'forbidden' })
      }
      if (myMember.status !== 'pending') {
        return jsonResponse(400, { error: 'already_responded' })
      }

      // Check accepter's global slot limit (excluding this piece)
      const { data: memberPieces } = await serviceClient
        .from('gum_piece_members')
        .select('gum_piece_id')
        .eq('user_id', userId)

      const allMemberPieceIds = (memberPieces ?? []).map((r: { gum_piece_id: string }) => r.gum_piece_id)
      const otherPieceIds = allMemberPieceIds.filter((id: string) => id !== gumPieceId)

      if (otherPieceIds.length > 0) {
        const { count: activeCount } = await serviceClient
          .from('gum_pieces')
          .select('id', { count: 'exact', head: true })
          .in('id', otherPieceIds)
          .in('status', ['placeholder', 'active'])

        if ((activeCount ?? 0) >= GLOBAL_SLOT_LIMIT) {
          return jsonResponse(400, { error: 'slot_limit_global', count: activeCount })
        }
      }

      // Accept: update member row
      const respondedAt = new Date().toISOString()
      const { error: memberUpdateError } = await serviceClient
        .from('gum_piece_members')
        .update({ status: 'accepted', responded_at: respondedAt })
        .eq('id', myMember.id)

      if (memberUpdateError) {
        return jsonResponse(500, { error: memberUpdateError.message })
      }

      // If piece is still placeholder, activate it
      let updatedPiece = piece
      if (piece.status === 'placeholder') {
        const acceptedAt = respondedAt
        let expiresAt: string
        if (piece.planned_date) {
          const d = new Date(piece.planned_date + 'T00:00:00Z')
          d.setUTCDate(d.getUTCDate() + 1)
          expiresAt = d.toISOString()
        } else {
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }

        const { data: activatedPiece, error: activateError } = await serviceClient
          .from('gum_pieces')
          .update({ status: 'active', accepted_at: acceptedAt, expires_at: expiresAt })
          .eq('id', gumPieceId)
          .select('*')
          .single()

        if (activateError || !activatedPiece) {
          return jsonResponse(500, { error: activateError?.message ?? 'Failed to activate piece.' })
        }
        updatedPiece = activatedPiece
      }

      // Notify creator
      const { error: notificationError } = await serviceClient
        .from('notifications')
        .insert({
          user_id: piece.creator_id,
          type: 'invite_accepted',
          reference_id: gumPieceId,
          read: false,
        })

      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }

      return jsonResponse(200, { success: true, gum_piece: updatedPiece })
    }

    // turn_down action
    if (piece.status !== 'placeholder' && piece.status !== 'active') {
      return jsonResponse(400, { error: 'invalid_status' })
    }

    if (myMember.role === 'creator') {
      // Creator cancels: set whole plan to turned_down, notify all other members
      const { data: updatedPiece, error: updateError } = await serviceClient
        .from('gum_pieces')
        .update({ status: 'turned_down' })
        .eq('id', gumPieceId)
        .select('*')
        .single()

      if (updateError || !updatedPiece) {
        return jsonResponse(500, { error: updateError?.message ?? 'Failed to cancel piece.' })
      }

      // Notify all other members
      const { data: otherMembers } = await serviceClient
        .from('gum_piece_members')
        .select('user_id')
        .eq('gum_piece_id', gumPieceId)
        .neq('user_id', userId)

      if ((otherMembers ?? []).length > 0) {
        const notifications = (otherMembers ?? []).map((m: { user_id: string }) => ({
          user_id: m.user_id,
          type: 'plan_turned_down',
          reference_id: gumPieceId,
          read: false,
        }))
        const { error: notifyError } = await serviceClient.from('notifications').insert(notifications)
        if (notifyError) {
          return jsonResponse(500, { error: notifyError.message })
        }
      }

      void sendTurnDownEmail({
        serviceClient,
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        actorUserId: userId,
        otherMembers: (otherMembers ?? []).map((m: { user_id: string }) => m.user_id),
        title: piece.title,
      }).catch(() => undefined)

      return jsonResponse(200, { success: true, gum_piece: updatedPiece })
    }

    // Invitee declining
    const { error: memberUpdateError } = await serviceClient
      .from('gum_piece_members')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', myMember.id)

    if (memberUpdateError) {
      return jsonResponse(500, { error: memberUpdateError.message })
    }

    // Check if all invitees have declined
    const { data: remainingInvitees, error: remainingError } = await serviceClient
      .from('gum_piece_members')
      .select('user_id, status')
      .eq('gum_piece_id', gumPieceId)
      .eq('role', 'invitee')

    if (remainingError) {
      return jsonResponse(500, { error: remainingError.message })
    }

    const allDeclined = (remainingInvitees ?? []).every((m: { status: string }) => m.status === 'declined')

    let notificationType: 'invite_rejected' | 'plan_turned_down' | 'member_declined'
    let finalPiece = piece

    if (allDeclined) {
      // All invitees declined — cancel the plan
      const { data: updatedPiece, error: updateError } = await serviceClient
        .from('gum_pieces')
        .update({ status: 'turned_down' })
        .eq('id', gumPieceId)
        .select('*')
        .single()

      if (updateError || !updatedPiece) {
        return jsonResponse(500, { error: updateError?.message ?? 'Failed to update piece.' })
      }

      finalPiece = updatedPiece
      notificationType = piece.status === 'placeholder' ? 'invite_rejected' : 'plan_turned_down'
    } else {
      // Plan stays active — notify creator someone declined
      notificationType = piece.status === 'placeholder' ? 'invite_rejected' : 'member_declined'
    }

    const { error: notificationError } = await serviceClient
      .from('notifications')
      .insert({
        user_id: piece.creator_id,
        type: notificationType,
        reference_id: gumPieceId,
        read: false,
      })

    if (notificationError) {
      return jsonResponse(500, { error: notificationError.message })
    }

    void sendTurnDownEmail({
      serviceClient,
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      actorUserId: userId,
      otherMembers: [piece.creator_id],
      title: piece.title,
    }).catch((error) => {
      console.error('respond-gum-piece sendTurnDownEmail failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })

    return jsonResponse(200, { success: true, gum_piece: finalPiece })
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

async function sendTurnDownEmail(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  actorUserId: string
  otherMembers: string[]
  title: string
}): Promise<void> {
  const { data: actorProfile } = await params.serviceClient
    .from('users')
    .select('display_name')
    .eq('id', params.actorUserId)
    .maybeSingle<{ display_name: string }>()

  const actorName = actorProfile?.display_name ?? 'Unknown user'

  for (const recipientUserId of params.otherMembers) {
    const { data: authData } = await params.serviceClient.auth.admin.getUserById(recipientUserId)
    const recipientEmail = authData.user?.email
    if (!recipientEmail) continue

    const response = await fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: 'A plan was turned down',
        body: `${actorName} passed on '${params.title}'.`,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`send-email failed (${response.status}): ${details}`)
    }
  }
}
