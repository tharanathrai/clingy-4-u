import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { categories, categorizeTitle } from '../_shared/categorize.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MAX_INVITEES = 9
const GLOBAL_SLOT_LIMIT = 25
const PAIR_SLOT_LIMIT = 5

interface CreateGumPieceBody {
  recipient_ids?: string[]
  title?: string
  category?: string
  planned_date?: string
}

const gumShapes = [
  'gum-strip',
  'gum-ball',
  'gum-chiclet',
  'gum-block',
  'gum-blob',
] as const

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

    const body = (await request.json()) as CreateGumPieceBody
    const title = body.title?.trim()

    if (!title) {
      return jsonResponse(400, { error: 'title_required' })
    }
    if (title.length > 60) {
      return jsonResponse(400, { error: 'title_too_long' })
    }

    const rawIds = body.recipient_ids
    if (!rawIds || !Array.isArray(rawIds) || rawIds.length === 0) {
      return jsonResponse(400, { error: 'recipient_required' })
    }

    const recipientIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))]

    if (recipientIds.length === 0) {
      return jsonResponse(400, { error: 'recipient_required' })
    }
    if (recipientIds.length > MAX_INVITEES) {
      return jsonResponse(400, { error: 'too_many_recipients', max: MAX_INVITEES })
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

    if (recipientIds.includes(userId)) {
      return jsonResponse(400, { error: 'recipient_required' })
    }

    // Verify active connection to each recipient
    for (const recipientId of recipientIds) {
      const { data: connection, error: connectionError } = await serviceClient
        .from('connections')
        .select('id')
        .eq('status', 'active')
        .or(
          `and(user_a_id.eq.${userId},user_b_id.eq.${recipientId}),and(user_a_id.eq.${recipientId},user_b_id.eq.${userId})`,
        )
        .maybeSingle()

      if (connectionError) {
        return jsonResponse(500, { error: connectionError.message })
      }
      if (!connection) {
        return jsonResponse(400, { error: 'connection_required', recipient_id: recipientId })
      }
    }

    const categorized = resolveCategory(title, body.category?.trim())

    // Check creator's global slot count
    const creatorSlotError = await checkGlobalSlotLimit(serviceClient, userId)
    if (creatorSlotError) {
      return creatorSlotError
    }

    // Check each recipient's global count and per-pair count with creator
    // First get creator's active/placeholder piece IDs for pair checks
    const creatorActivePieceIds = await getMemberActivePieceIds(serviceClient, userId)

    for (const recipientId of recipientIds) {
      // Recipient global slot check
      const recipientSlotError = await checkGlobalSlotLimit(serviceClient, recipientId, 'slot_limit_global_recipient', recipientId)
      if (recipientSlotError) {
        return recipientSlotError
      }

      // Per-pair check: count plans where both creator and recipient are members
      const pairError = await checkPairSlotLimit(serviceClient, recipientId, creatorActivePieceIds, recipientId)
      if (pairError) {
        return pairError
      }
    }

    const plannedDate = resolvePlannedDate(body.planned_date)
    if (plannedDate === null) {
      return jsonResponse(400, { error: 'planned_date_invalid' })
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const shape = getRandomShape()

    const { data: createdPiece, error: createPieceError } = await serviceClient
      .from('gum_pieces')
      .insert({
        creator_id: userId,
        recipient_id: null,
        title,
        category: categorized.slug,
        color_hex: categorized.color_hex,
        shape,
        status: 'placeholder',
        expires_at: expiresAt,
        planned_date: plannedDate,
      })
      .select('id, title, category, color_hex, status, expires_at')
      .single()

    if (createPieceError || !createdPiece) {
      return jsonResponse(500, { error: createPieceError?.message ?? 'Failed to create gum piece.' })
    }

    const pieceId = createdPiece.id
    const now = new Date().toISOString()

    // Insert members: creator (accepted) + all invitees (pending)
    const memberRows = [
      { gum_piece_id: pieceId, user_id: userId, role: 'creator', status: 'accepted', invited_at: now, responded_at: now },
      ...recipientIds.map((recipientId) => ({
        gum_piece_id: pieceId,
        user_id: recipientId,
        role: 'invitee',
        status: 'pending',
        invited_at: now,
        responded_at: null,
      })),
    ]

    const { error: membersError } = await serviceClient
      .from('gum_piece_members')
      .insert(memberRows)

    if (membersError) {
      return jsonResponse(500, { error: membersError.message })
    }

    // Bulk notify all recipients
    const notificationRows = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      type: 'invite_received',
      reference_id: pieceId,
      read: false,
    }))

    const { error: notificationError } = await serviceClient
      .from('notifications')
      .insert(notificationRows)

    if (notificationError) {
      return jsonResponse(500, { error: notificationError.message })
    }

    // Fire-and-forget invite emails
    for (const recipientId of recipientIds) {
      void sendInviteEmail({
        serviceClient,
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        creatorId: userId,
        recipientId,
        title: createdPiece.title,
      }).catch(() => undefined)
    }

    return jsonResponse(200, { gum_piece: createdPiece })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

async function getMemberActivePieceIds(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string[]> {
  // Get piece IDs this user is a member of that are active/placeholder
  const { data: memberRows } = await serviceClient
    .from('gum_piece_members')
    .select('gum_piece_id')
    .eq('user_id', userId)

  const pieceIds = (memberRows ?? []).map((r: { gum_piece_id: string }) => r.gum_piece_id)
  if (pieceIds.length === 0) return []

  const { data: activePieces } = await serviceClient
    .from('gum_pieces')
    .select('id')
    .in('id', pieceIds)
    .in('status', ['placeholder', 'active'])

  return (activePieces ?? []).map((r: { id: string }) => r.id)
}

async function checkGlobalSlotLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  errorCode = 'slot_limit_global',
  recipientId?: string,
): Promise<Response | null> {
  const activePieceIds = await getMemberActivePieceIds(serviceClient, userId)
  const count = activePieceIds.length
  if (count >= GLOBAL_SLOT_LIMIT) {
    return jsonResponse(400, {
      error: errorCode,
      count,
      ...(recipientId ? { recipient_id: recipientId } : {}),
    })
  }
  return null
}

async function checkPairSlotLimit(
  serviceClient: ReturnType<typeof createClient>,
  recipientId: string,
  creatorActivePieceIds: string[],
  recipientIdForError: string,
): Promise<Response | null> {
  if (creatorActivePieceIds.length === 0) return null

  const { count, error } = await serviceClient
    .from('gum_piece_members')
    .select('gum_piece_id', { count: 'exact', head: true })
    .eq('user_id', recipientId)
    .in('gum_piece_id', creatorActivePieceIds)

  if (error) {
    return jsonResponse(500, { error: error.message })
  }

  if ((count ?? 0) >= PAIR_SLOT_LIMIT) {
    return jsonResponse(400, {
      error: 'slot_limit_pair',
      recipient_id: recipientIdForError,
      count,
    })
  }

  return null
}

function resolvePlannedDate(raw?: string): string | null {
  const maxMs = Date.now() + 365 * 24 * 60 * 60 * 1000
  if (!raw) {
    return new Date(maxMs).toISOString().slice(0, 10)
  }
  const parsed = new Date(raw + 'T00:00:00Z')
  if (isNaN(parsed.getTime())) {
    return null
  }
  if (parsed.getTime() > maxMs) {
    return null
  }
  const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  if (parsed.getTime() < todayMs) {
    return null
  }
  return raw
}

function resolveCategory(title: string, requestedSlug?: string) {
  if (requestedSlug) {
    const match = categories.find((category) => category.slug === requestedSlug)
    if (match) {
      return match
    }
  }
  return categorizeTitle(title)
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRandomShape(): (typeof gumShapes)[number] {
  const index = Math.floor(Math.random() * gumShapes.length)
  return gumShapes[index]
}

async function sendInviteEmail(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  creatorId: string
  recipientId: string
  title: string
}): Promise<void> {
  const { data: creatorProfile } = await params.serviceClient
    .from('users')
    .select('display_name')
    .eq('id', params.creatorId)
    .maybeSingle<{ display_name: string }>()

  const creatorName = creatorProfile?.display_name ?? 'Unknown user'
  const { data: recipientAuthData } = await params.serviceClient.auth.admin.getUserById(
    params.recipientId,
  )
  const recipientEmail = recipientAuthData.user?.email
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
      subject: `${creatorName} wants to make a plan with you`,
      body: `${creatorName} sent you a plan: '${params.title}'. Open the app to accept or pass.`,
    }),
  })
}
