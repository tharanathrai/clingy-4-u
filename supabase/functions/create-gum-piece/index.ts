import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { categorizeTitle } from '../_shared/categorize.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface CreateGumPieceBody {
  recipient_id?: string
  title?: string
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
    const recipientId = body.recipient_id?.trim()
    const title = body.title?.trim()

    if (!title) {
      return jsonResponse(400, { error: 'title_required' })
    }

    if (title.length > 60) {
      return jsonResponse(400, { error: 'title_too_long' })
    }

    if (!recipientId) {
      return jsonResponse(400, { error: 'recipient_required' })
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
    if (recipientId === userId) {
      return jsonResponse(400, { error: 'recipient_required' })
    }

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
      return jsonResponse(400, { error: 'connection_required' })
    }

    const categorized = categorizeTitle(title)

    const { count: globalCount, error: globalCountError } = await serviceClient
      .from('gum_pieces')
      .select('id', { count: 'exact', head: true })
      .in('status', ['placeholder', 'active'])
      .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)

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

    const pairFilter = `and(creator_id.eq.${userId},recipient_id.eq.${recipientId}),and(creator_id.eq.${recipientId},recipient_id.eq.${userId})`
    const { count: pairCount, error: pairCountError } = await serviceClient
      .from('gum_pieces')
      .select('id', { count: 'exact', head: true })
      .in('status', ['placeholder', 'active'])
      .or(pairFilter)

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

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const shape = getRandomShape()
    const { data: createdPiece, error: createPieceError } = await serviceClient
      .from('gum_pieces')
      .insert({
        creator_id: userId,
        recipient_id: recipientId,
        title,
        category: categorized.slug,
        color_hex: categorized.color_hex,
        shape,
        status: 'placeholder',
        expires_at: expiresAt,
      })
      .select('id, title, category, color_hex, status, expires_at')
      .single()

    if (createPieceError || !createdPiece) {
      return jsonResponse(500, { error: createPieceError?.message ?? 'Failed to create gum piece.' })
    }

    const { error: notificationError } = await serviceClient.from('notifications').insert({
      user_id: recipientId,
      type: 'invite_received',
      reference_id: createdPiece.id,
      read: false,
    })

    if (notificationError) {
      return jsonResponse(500, { error: notificationError.message })
    }

    void sendInviteEmail({
      serviceClient,
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      creatorId: userId,
      recipientId,
      title: createdPiece.title,
    }).catch(() => undefined)

    return jsonResponse(200, {
      gum_piece: createdPiece,
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
