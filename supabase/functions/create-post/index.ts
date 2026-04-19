import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface CreatePostBody {
  bridge_id?: string
  body?: string
  is_public?: boolean
}

interface BridgeRow {
  id: string
  user_a_id: string
  user_b_id: string
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

    const payload = (await request.json()) as CreatePostBody
    const bridgeId = payload.bridge_id?.trim()
    const postBody = payload.body?.trim()
    const isPublic = payload.is_public

    if (!bridgeId) {
      return jsonResponse(400, { error: 'bridge_id_required' })
    }
    if (!postBody) {
      return jsonResponse(400, { error: 'body_required' })
    }
    if (postBody.length > 500) {
      return jsonResponse(400, { error: 'body_too_long' })
    }
    if (typeof isPublic !== 'boolean') {
      return jsonResponse(400, { error: 'is_public_required' })
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

    const { data: bridge, error: bridgeError } = await serviceClient
      .from('bridges')
      .select('id, user_a_id, user_b_id')
      .eq('id', bridgeId)
      .maybeSingle<BridgeRow>()

    if (bridgeError) {
      return jsonResponse(500, { error: bridgeError.message })
    }
    if (!bridge) {
      return jsonResponse(404, { error: 'bridge_not_found' })
    }
    if (bridge.user_a_id !== userId && bridge.user_b_id !== userId) {
      return jsonResponse(403, { error: 'forbidden' })
    }

    const { data: post, error: createPostError } = await serviceClient
      .from('posts')
      .insert({
        bridge_id: bridge.id,
        author_id: userId,
        body: postBody,
        is_public: isPublic,
      })
      .select('*')
      .single()

    if (createPostError || !post) {
      return jsonResponse(500, {
        error: createPostError?.message ?? 'Failed to create post.',
      })
    }

    return jsonResponse(200, { post })
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
