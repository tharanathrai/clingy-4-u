import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface ValidateBody {
  token?: string
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
    const body = (await request.json()) as ValidateBody
    const token = body.token?.trim()

    if (!token) {
      return jsonResponse(400, { error: 'Missing token.' })
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

    const { data: tokenRow, error: tokenError } = await serviceClient
      .from('rotating_qr_tokens')
      .select('id, user_id, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return jsonResponse(400, { error: 'Invalid token.' })
    }

    if (tokenRow.user_id === authData.user.id) {
      return jsonResponse(400, { error: 'That is your own QR code.' })
    }

    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      return jsonResponse(400, { error: 'This code has expired. Ask them to refresh.' })
    }

    const userA = [authData.user.id, tokenRow.user_id].sort()[0]
    const userB = [authData.user.id, tokenRow.user_id].sort()[1]

    const { data: existingConnection, error: existingConnectionError } = await serviceClient
      .from('connections')
      .select('id')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .maybeSingle()

    if (existingConnectionError) {
      return jsonResponse(500, { error: existingConnectionError.message })
    }

    if (existingConnection) {
      return jsonResponse(400, { error: "You're already connected with this person." })
    }

    const { error: consumeTokenError } = await serviceClient
      .from('rotating_qr_tokens')
      .delete()
      .eq('id', tokenRow.id)

    if (consumeTokenError) {
      return jsonResponse(500, { error: consumeTokenError.message })
    }

    const { data: createdConnection, error: createConnectionError } = await serviceClient
      .from('connections')
      .insert({
        user_a_id: userA,
        user_b_id: userB,
        status: 'pending',
        requested_by: authData.user.id,
      })
      .select('id')
      .single()

    if (createConnectionError || !createdConnection) {
      return jsonResponse(500, { error: createConnectionError?.message ?? 'Failed to connect.' })
    }

    const { data: scannedUser, error: scannedUserError } = await serviceClient
      .from('users')
      .select('display_name, username, avatar_url')
      .eq('id', tokenRow.user_id)
      .single()

    if (scannedUserError || !scannedUser) {
      return jsonResponse(500, { error: scannedUserError?.message ?? 'User not found.' })
    }

    return jsonResponse(200, {
      success: true,
      user: scannedUser,
      connection_id: createdConnection.id,
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
