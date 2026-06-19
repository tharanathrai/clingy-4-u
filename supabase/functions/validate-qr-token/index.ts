import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface ValidateBody {
  token?: string
  preview?: boolean
}

interface ScannedUser {
  display_name: string
  username: string
  avatar_url: string | null
}

interface ExistingConnection {
  id: string
  status: 'pending' | 'active' | 'removed'
  requested_by: string
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
      return jsonResponse(400, {
        error: 'This is not a Clingy connection code.',
        error_code: 'invalid_token',
      })
    }

    const { data: scannedUser, error: scannedUserError } = await serviceClient
      .from('users')
      .select('display_name, username, avatar_url')
      .eq('id', tokenRow.user_id)
      .single()

    if (scannedUserError || !scannedUser) {
      return jsonResponse(500, {
        error: scannedUserError?.message ?? 'User not found.',
        error_code: 'scanned_user_not_found',
      })
    }

    if (tokenRow.user_id === authData.user.id) {
      return jsonResponse(400, {
        error: 'That is your own QR code.',
        error_code: 'own_qr',
      })
    }

    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      return jsonResponse(400, {
        error: 'This code has expired. Ask them to refresh.',
        error_code: 'expired',
      })
    }

    const userA = [authData.user.id, tokenRow.user_id].sort()[0]
    const userB = [authData.user.id, tokenRow.user_id].sort()[1]

    const { data: existingConnection, error: existingConnectionError } = await serviceClient
      .from('connections')
      .select('id, status, requested_by')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .maybeSingle<ExistingConnection>()

    if (existingConnectionError) {
      return jsonResponse(500, { error: existingConnectionError.message })
    }

    if (existingConnection) {
      if (existingConnection.status === 'pending') {
        const message =
          existingConnection.requested_by === authData.user.id
            ? 'You already sent a request to this person.'
            : "There's already a pending request with this person."

        return jsonResponse(400, {
          error: message,
          error_code: 'request_pending',
          user: scannedUser as ScannedUser,
        })
      }

      if (existingConnection.status === 'active') {
        return jsonResponse(400, {
          error: "You're already connected with this person.",
          error_code: 'already_connected',
          user: scannedUser as ScannedUser,
        })
      }

      // status === 'removed': allow re-friending — fall through but use UPDATE below
    }

    if (body.preview === true) {
      return jsonResponse(200, {
        success: true,
        preview: true,
        user: scannedUser,
      })
    }

    const { error: consumeTokenError } = await serviceClient
      .from('rotating_qr_tokens')
      .delete()
      .eq('id', tokenRow.id)

    if (consumeTokenError) {
      return jsonResponse(500, { error: consumeTokenError.message })
    }

    let connectionId: string

    if (existingConnection?.status === 'removed') {
      // Reuse the existing row — reset to pending and clear snooze flags
      const { data: updatedConnection, error: updateConnectionError } = await serviceClient
        .from('connections')
        .update({
          status: 'pending',
          requested_by: authData.user.id,
          accepted_at: null,
          snoozed_by_a: false,
          snoozed_by_b: false,
        })
        .eq('id', existingConnection.id)
        .select('id')
        .single()

      if (updateConnectionError || !updatedConnection) {
        return jsonResponse(500, { error: updateConnectionError?.message ?? 'Failed to reconnect.' })
      }
      connectionId = updatedConnection.id
    } else {
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
      connectionId = createdConnection.id
    }

    const createdConnection = { id: connectionId }

    const { error: notificationError } = await serviceClient.from('notifications').insert({
      user_id: tokenRow.user_id,
      type: 'connection_request',
      reference_id: createdConnection.id,
      read: false,
    })

    // Keep the core connect flow successful even if notification insert fails.
    if (notificationError) {
      // Intentionally non-fatal: connection row is already created.
    }

    void sendConnectionRequestEmail({
      serviceClient,
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      requesterId: authData.user.id,
      recipientId: tokenRow.user_id,
    }).catch(() => undefined)

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

async function sendConnectionRequestEmail(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  requesterId: string
  recipientId: string
}): Promise<void> {
  const { data: requesterProfile } = await params.serviceClient
    .from('users')
    .select('display_name')
    .eq('id', params.requesterId)
    .maybeSingle<{ display_name: string }>()

  const requesterName = requesterProfile?.display_name ?? 'Someone'
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
      subject: `${requesterName} wants to connect with you`,
      body: `${requesterName} sent you a connection request. Open the app to accept or decline.`,
    }),
  })
}
