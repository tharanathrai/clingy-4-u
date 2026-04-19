import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface ToggleReactionBody {
  post_id?: string
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

    const payload = (await request.json()) as ToggleReactionBody
    const postId = payload.post_id?.trim()
    if (!postId) {
      return jsonResponse(400, { error: 'post_id_required' })
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

    const { data: existingReaction, error: existingReactionError } = await serviceClient
      .from('reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>()

    if (existingReactionError) {
      return jsonResponse(500, { error: existingReactionError.message })
    }

    let reacted = false
    if (existingReaction?.id) {
      const { error: deleteError } = await serviceClient
        .from('reactions')
        .delete()
        .eq('id', existingReaction.id)
        .eq('user_id', userId)
      if (deleteError) {
        return jsonResponse(500, { error: deleteError.message })
      }
    } else {
      const { error: insertError } = await serviceClient.from('reactions').insert({
        post_id: postId,
        user_id: userId,
      })
      if (insertError) {
        return jsonResponse(500, { error: insertError.message })
      }
      reacted = true
    }

    const { count, error: countError } = await serviceClient
      .from('reactions')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)

    if (countError) {
      return jsonResponse(500, { error: countError.message })
    }

    return jsonResponse(200, {
      reacted,
      reaction_count: count ?? 0,
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
