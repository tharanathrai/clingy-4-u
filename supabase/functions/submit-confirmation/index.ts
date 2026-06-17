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
  confirmed_member_ids: string[]
  expires_at: string
}

interface GumPieceRow {
  id: string
  creator_id: string
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
      .select('id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at')
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
      .select('id, creator_id, title, category, color_hex, status')
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

    // Authorization: caller must be an accepted member
    const { data: memberRow, error: memberError } = await serviceClient
      .from('gum_piece_members')
      .select('id, status')
      .eq('gum_piece_id', piece.id)
      .eq('user_id', userId)
      .maybeSingle<{ id: string; status: string }>()

    if (memberError) {
      return jsonResponse(500, { error: memberError.message })
    }
    if (!memberRow || memberRow.status !== 'accepted') {
      return jsonResponse(403, { error: 'forbidden' })
    }

    // Add this user to confirmed_member_ids if not already present
    const currentConfirmed = session.confirmed_member_ids ?? []
    const updatedConfirmed = currentConfirmed.includes(userId)
      ? currentConfirmed
      : [...currentConfirmed, userId]

    const { data: updatedSession, error: updateSessionError } = await serviceClient
      .from('confirmation_sessions')
      .update({ confirmed_member_ids: updatedConfirmed })
      .eq('id', session.id)
      .select('id, gum_piece_id, otp_code, initiator_id, confirmed_member_ids, expires_at')
      .single<ConfirmationSessionRow>()

    if (updateSessionError || !updatedSession) {
      return jsonResponse(500, {
        error: updateSessionError?.message ?? 'Failed to update confirmation state.',
      })
    }

    // Fetch all accepted members for this piece
    const { data: acceptedMembers, error: membersError } = await serviceClient
      .from('gum_piece_members')
      .select('user_id')
      .eq('gum_piece_id', piece.id)
      .eq('status', 'accepted')

    if (membersError) {
      return jsonResponse(500, { error: membersError.message })
    }

    const acceptedMemberIds = (acceptedMembers ?? []).map((m: { user_id: string }) => m.user_id)
    const confirmedIds = updatedSession.confirmed_member_ids ?? []
    const sessionStillValid = new Date(updatedSession.expires_at).getTime() > Date.now()

    // Bridge forms when all accepted members have confirmed and session is still valid
    const allConfirmed =
      sessionStillValid &&
      acceptedMemberIds.length > 0 &&
      acceptedMemberIds.every((id) => confirmedIds.includes(id))

    if (!allConfirmed) {
      return jsonResponse(200, { success: true, bridge_formed: false, confirmed_member_ids: confirmedIds })
    }

    // Check if bridges already formed for this piece
    const { data: existingBridges, error: existingBridgesError } = await serviceClient
      .from('bridges')
      .select('id, activity_title, category, color_hex, formed_at')
      .eq('gum_piece_id', piece.id)

    if (existingBridgesError) {
      return jsonResponse(500, { error: existingBridgesError.message })
    }

    let bridges = existingBridges as BridgeRow[] | null

    if (!bridges || bridges.length === 0) {
      // Mark piece as confirmed
      const { error: updatePieceError } = await serviceClient
        .from('gum_pieces')
        .update({ status: 'confirmed', confirmed_at: nowIso })
        .eq('id', piece.id)

      if (updatePieceError) {
        return jsonResponse(500, { error: updatePieceError.message })
      }

      // Create all N-choose-2 bridge pairs
      const bridgeRows = []
      for (let i = 0; i < acceptedMemberIds.length; i++) {
        for (let j = i + 1; j < acceptedMemberIds.length; j++) {
          const sorted = [acceptedMemberIds[i], acceptedMemberIds[j]].sort()
          bridgeRows.push({
            gum_piece_id: piece.id,
            user_a_id: sorted[0],
            user_b_id: sorted[1],
            category: piece.category,
            color_hex: piece.color_hex,
            activity_title: piece.title,
            formed_at: nowIso,
          })
        }
      }

      const { data: createdBridges, error: createBridgesError } = await serviceClient
        .from('bridges')
        .insert(bridgeRows)
        .select('id, activity_title, category, color_hex, formed_at')

      if (createBridgesError || !createdBridges) {
        // Retry read in case of race condition
        const retry = await serviceClient
          .from('bridges')
          .select('id, activity_title, category, color_hex, formed_at')
          .eq('gum_piece_id', piece.id)

        if (retry.error || !retry.data || retry.data.length === 0) {
          return jsonResponse(500, {
            error: createBridgesError?.message ?? retry.error?.message ?? 'Failed to create bridges.',
          })
        }
        bridges = retry.data as BridgeRow[]
      } else {
        bridges = createdBridges as BridgeRow[]
      }

      // Notify all accepted members
      const notifications = acceptedMemberIds.flatMap((memberId) =>
        (bridges ?? []).map((bridge) => ({
          user_id: memberId,
          type: 'bridge_formed',
          reference_id: bridge.id,
          read: false,
        }))
      )

      // Deduplicate notifications (each user gets one bridge_formed per bridge)
      const { error: notificationError } = await serviceClient
        .from('notifications')
        .insert(notifications)

      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }

      // Create draft posts: each member gets a draft post per bridge they're in
      await ensureDraftPosts({
        serviceClient,
        bridges: bridges ?? [],
        acceptedMemberIds,
        callingUserId: userId,
        creatorId: piece.creator_id,
        category: piece.category,
        title: piece.title,
      })
    }

    // Find the bridge between the caller and another member (for the draft post response)
    const callerBridge = (bridges ?? []).find(
      (b) => b.id && (
        (acceptedMemberIds.includes(userId))
      )
    ) ?? bridges?.[0]

    const { error: deleteSessionError } = await serviceClient
      .from('confirmation_sessions')
      .delete()
      .eq('id', session.id)

    if (deleteSessionError) {
      return jsonResponse(500, { error: deleteSessionError.message })
    }

    // Find caller's draft post
    let draftPostId: string | null = null
    let draftPostBody: string | null = null

    if (callerBridge) {
      const { data: draftPost } = await serviceClient
        .from('posts')
        .select('id, body')
        .eq('bridge_id', callerBridge.id)
        .eq('author_id', userId)
        .eq('is_public', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; body: string }>()

      draftPostId = draftPost?.id ?? null
      draftPostBody = draftPost?.body ?? null
    }

    return jsonResponse(200, {
      success: true,
      bridge_formed: true,
      bridges,
      draft_post_id: draftPostId,
      draft_post_body: draftPostBody,
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

async function ensureDraftPosts(params: {
  serviceClient: ReturnType<typeof createClient>
  bridges: BridgeRow[]
  acceptedMemberIds: string[]
  callingUserId: string
  creatorId: string
  category: string
  title: string
}): Promise<void> {
  const { data: users } = await params.serviceClient
    .from('users')
    .select('id, display_name')
    .in('id', params.acceptedMemberIds)

  const userRows = (users ?? []) as { id: string; display_name: string }[]
  const nameById = new Map(userRows.map((u) => [u.id, u.display_name]))

  // For each bridge, create a draft post for each of the two participants
  for (const bridge of params.bridges) {
    const participants = [bridge.user_a_id, bridge.user_b_id]
    for (const authorId of participants) {
      const partnerId = participants.find((id) => id !== authorId) ?? participants[0]
      const authorName = nameById.get(authorId) ?? 'Unknown'
      const partnerName = nameById.get(partnerId) ?? 'someone'

      const body = buildDraftBody({
        firstName: authorName,
        secondName: partnerName,
        title: params.title,
        category: params.category,
      })

      await ensureDraftPostForUser({
        serviceClient: params.serviceClient,
        bridgeId: bridge.id,
        authorId,
        body,
      })
    }
  }
}

async function ensureDraftPostForUser(params: {
  serviceClient: ReturnType<typeof createClient>
  bridgeId: string
  authorId: string
  body: string
}): Promise<string | null> {
  const { data: existingDraft } = await params.serviceClient
    .from('posts')
    .select('id')
    .eq('bridge_id', params.bridgeId)
    .eq('author_id', params.authorId)
    .eq('is_public', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (existingDraft?.id) {
    return existingDraft.id
  }

  const { data: createdPost } = await params.serviceClient
    .from('posts')
    .insert({
      bridge_id: params.bridgeId,
      author_id: params.authorId,
      body: params.body,
      is_public: false,
    })
    .select('id')
    .single<{ id: string }>()

  return createdPost?.id ?? null
}

function buildDraftBody(params: {
  firstName: string
  secondName: string
  title: string
  category: string
}): string {
  const cleanedTitle = params.title.trim().replace(/[.!?]+$/g, '')
  const names = `${params.firstName} and ${params.secondName}`
  if (params.category === 'active') return `${names} went ${cleanedTitle}.`
  if (params.category === 'savor') return `${names} shared ${cleanedTitle}.`
  if (params.category === 'intimate') return `${names} had ${cleanedTitle}.`
  if (params.category === 'explore') return `${names} explored ${cleanedTitle}.`
  if (params.category === 'recharge') return `${names} did ${cleanedTitle}.`
  if (params.category === 'playful') return `${names} made ${cleanedTitle}.`
  if (params.category === 'support') return `${names} showed up for ${cleanedTitle}.`
  return `${names}: ${cleanedTitle}.`
}
