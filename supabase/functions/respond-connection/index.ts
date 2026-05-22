import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface RespondConnectionBody {
  connection_id?: string
  action?: 'accept' | 'reject'
}

interface ConnectionRow {
  id: string
  user_a_id: string
  user_b_id: string
  requested_by: string
  status: 'pending' | 'active'
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

    const body = (await request.json()) as RespondConnectionBody
    const connectionId = body.connection_id?.trim()
    const action = body.action

    if (!connectionId) {
      return jsonResponse(400, { error: 'connection_id_required' })
    }

    if (!action || (action !== 'accept' && action !== 'reject')) {
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
    const { data: connection, error: connectionError } = await serviceClient
      .from('connections')
      .select('id, user_a_id, user_b_id, requested_by, status')
      .eq('id', connectionId)
      .maybeSingle<ConnectionRow>()

    if (connectionError) {
      return jsonResponse(500, { error: connectionError.message })
    }
    if (!connection) {
      return jsonResponse(404, { error: 'connection_not_found' })
    }
    if (connection.user_a_id !== userId && connection.user_b_id !== userId) {
      return jsonResponse(403, { error: 'forbidden' })
    }
    if (connection.requested_by === userId) {
      return jsonResponse(403, { error: 'requester_cannot_respond' })
    }
    if (connection.status !== 'pending') {
      return jsonResponse(400, { error: 'invalid_status' })
    }

    if (action === 'accept') {
      const acceptedAt = new Date().toISOString()
      const { error: updateError } = await serviceClient
        .from('connections')
        .update({
          status: 'active',
          accepted_at: acceptedAt,
        })
        .eq('id', connection.id)
        .eq('status', 'pending')

      if (updateError) {
        return jsonResponse(500, { error: updateError.message })
      }

      const { error: notificationError } = await serviceClient.from('notifications').insert({
        user_id: connection.requested_by,
        type: 'connection_accepted',
        reference_id: connection.id,
        read: false,
      })

      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }

      const otherUserId = connection.user_a_id === userId ? connection.user_b_id : connection.user_a_id
      return jsonResponse(200, {
        success: true,
        action: 'accept',
        connection_id: connection.id,
        other_user_id: otherUserId,
      })
    }

    const { error: deleteConnectionError } = await serviceClient
      .from('connections')
      .delete()
      .eq('id', connection.id)
      .eq('status', 'pending')
    if (deleteConnectionError) {
      return jsonResponse(500, { error: deleteConnectionError.message })
    }

    const { error: deleteNotificationsError } = await serviceClient
      .from('notifications')
      .delete()
      .eq('reference_id', connection.id)
      .eq('type', 'connection_request')

    if (deleteNotificationsError) {
      return jsonResponse(500, { error: deleteNotificationsError.message })
    }

    return jsonResponse(200, {
      success: true,
      action: 'reject',
      connection_id: connection.id,
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
