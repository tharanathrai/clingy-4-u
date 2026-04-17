import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface RespondGumPieceBody {
  gum_piece_id?: string
  action?: 'accept' | 'turn_down'
}

type GumPieceRow = {
  id: string
  creator_id: string
  recipient_id: string
  title: string
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse(401, { error: authError?.message ?? 'Unauthorized.' })
    }

    const userId = authData.user.id
    const { data: piece, error: pieceError } = await supabase
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, title, status')
      .eq('id', gumPieceId)
      .maybeSingle<GumPieceRow>()

    if (pieceError) {
      return jsonResponse(500, { error: pieceError.message })
    }

    if (!piece) {
      return jsonResponse(404, { error: 'gum_piece_not_found' })
    }

    if (piece.creator_id !== userId && piece.recipient_id !== userId) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    if (action === 'accept') {
      if (piece.status !== 'placeholder') {
        return jsonResponse(400, { error: 'invalid_status' })
      }

      if (piece.recipient_id !== userId) {
        return jsonResponse(403, { error: 'forbidden' })
      }

      const { count: globalCount, error: globalCountError } = await supabase
        .from('gum_pieces')
        .select('id', { count: 'exact', head: true })
        .in('status', ['placeholder', 'active'])
        .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)
        .neq('id', piece.id)

      if (globalCountError) {
        return jsonResponse(500, { error: globalCountError.message })
      }

      const safeGlobalCount = globalCount ?? 0
      if (safeGlobalCount >= 25) {
        return jsonResponse(400, {
          error: 'slot_limit_global',
          count: safeGlobalCount,
        })
      }

      const sortedPair = [piece.creator_id, piece.recipient_id].sort()
      const userA = sortedPair[0]
      const userB = sortedPair[1]
      const pairFilter = `and(creator_id.eq.${userA},recipient_id.eq.${userB}),and(creator_id.eq.${userB},recipient_id.eq.${userA})`

      const { count: pairCount, error: pairCountError } = await supabase
        .from('gum_pieces')
        .select('id', { count: 'exact', head: true })
        .in('status', ['placeholder', 'active'])
        .or(pairFilter)
        .neq('id', piece.id)

      if (pairCountError) {
        return jsonResponse(500, { error: pairCountError.message })
      }

      const safePairCount = pairCount ?? 0
      if (safePairCount >= 5) {
        return jsonResponse(400, {
          error: 'slot_limit_pair',
          count: safePairCount,
        })
      }

      const acceptedAt = new Date().toISOString()
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const { data: updatedPiece, error: updateError } = await supabase
        .from('gum_pieces')
        .update({
          status: 'active',
          accepted_at: acceptedAt,
          expires_at: expiresAt,
        })
        .eq('id', piece.id)
        .select('*')
        .single()

      if (updateError || !updatedPiece) {
        return jsonResponse(500, { error: updateError?.message ?? 'Failed to accept piece.' })
      }

      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: piece.creator_id,
        type: 'invite_accepted',
        reference_id: piece.id,
        read: false,
      })

      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }

      return jsonResponse(200, {
        success: true,
        gum_piece: updatedPiece,
      })
    }

    if (piece.status !== 'placeholder' && piece.status !== 'active') {
      return jsonResponse(400, { error: 'invalid_status' })
    }

    const previousStatus = piece.status
    const { data: updatedPiece, error: updateError } = await supabase
      .from('gum_pieces')
      .update({
        status: 'turned_down',
      })
      .eq('id', piece.id)
      .select('*')
      .single()

    if (updateError || !updatedPiece) {
      return jsonResponse(500, { error: updateError?.message ?? 'Failed to update piece.' })
    }

    const otherPartyId = userId === piece.creator_id ? piece.recipient_id : piece.creator_id
    let notificationType: 'invite_rejected' | 'plan_turned_down'
    if (previousStatus === 'placeholder') {
      // Creator cancelling a placeholder should not read as recipient "passed".
      notificationType = userId === piece.creator_id ? 'plan_turned_down' : 'invite_rejected'
    } else {
      notificationType = 'plan_turned_down'
    }

    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: otherPartyId,
      type: notificationType,
      reference_id: piece.id,
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
      recipientUserId: otherPartyId,
      title: piece.title,
    }).catch(() => undefined)

    return jsonResponse(200, {
      success: true,
      gum_piece: updatedPiece,
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

async function sendTurnDownEmail(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  actorUserId: string
  recipientUserId: string
  title: string
}): Promise<void> {
  const { data: actorProfile } = await params.serviceClient
    .from('users')
    .select('display_name')
    .eq('id', params.actorUserId)
    .maybeSingle<{ display_name: string }>()

  const actorName = actorProfile?.display_name ?? 'Someone'
  const { data: authData } = await params.serviceClient.auth.admin.getUserById(
    params.recipientUserId,
  )
  const recipientEmail = authData.user?.email
  if (!recipientEmail) {
    return
  }

  await fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.serviceRoleKey}`,
    },
    body: JSON.stringify({
      to: recipientEmail,
      subject: 'A plan was turned down',
      body: `${actorName} passed on '${params.title}'. Your slot is now free.`,
    }),
  })
}
