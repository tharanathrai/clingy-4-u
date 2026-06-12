import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildExpiringSoonNotificationRows,
  getExpiringSoonWindow,
  usersNeedingExpiringSoonEmail,
} from '../_shared/expiringSoon.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface ActivePieceRow {
  id: string
  creator_id: string
  recipient_id: string
  title: string
  category: string
  color_hex: string
  created_at: string
}

interface ExpiringSoonPieceRow {
  id: string
  creator_id: string
  recipient_id: string
  title: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Supabase environment is not configured.' })
    }

    const authHeader = request.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token || token !== supabaseServiceRoleKey) {
      return jsonResponse(401, { error: 'unauthorized' })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    const nowIso = new Date().toISOString()

    const { data: expiredPlaceholders, error: placeholderError } = await serviceClient
      .from('gum_pieces')
      .update({ status: 'expired' })
      .eq('status', 'placeholder')
      .lt('expires_at', nowIso)
      .select('id')

    if (placeholderError) {
      return jsonResponse(500, { error: placeholderError.message })
    }

    const { windowStartIso, windowEndIso } = getExpiringSoonWindow(new Date(nowIso))
    const { data: expiringSoonPieces, error: expiringSoonError } = await serviceClient
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, title')
      .eq('status', 'active')
      .gt('expires_at', windowStartIso)
      .lte('expires_at', windowEndIso)

    if (expiringSoonError) {
      return jsonResponse(500, { error: expiringSoonError.message })
    }

    let expiringSoonNotified = 0
    const expiringSoonPieceRows = (expiringSoonPieces ?? []) as ExpiringSoonPieceRow[]
    if (expiringSoonPieceRows.length > 0) {
      const expiringSoonPieceIds = expiringSoonPieceRows.map((piece) => piece.id)
      const { data: existingExpiringSoon, error: existingExpiringSoonError } =
        await serviceClient
          .from('notifications')
          .select('user_id, reference_id, type')
          .eq('type', 'plan_expiring_soon')
          .in('reference_id', expiringSoonPieceIds)

      if (existingExpiringSoonError) {
        return jsonResponse(500, { error: existingExpiringSoonError.message })
      }

      const expiringSoonNotificationRows = buildExpiringSoonNotificationRows(
        expiringSoonPieceRows,
        existingExpiringSoon ?? [],
      )

      if (expiringSoonNotificationRows.length > 0) {
        const { error: expiringSoonInsertError } = await serviceClient
          .from('notifications')
          .insert(expiringSoonNotificationRows)
        if (expiringSoonInsertError) {
          return jsonResponse(500, { error: expiringSoonInsertError.message })
        }

        expiringSoonNotified = expiringSoonNotificationRows.length

        const usersByPiece = usersNeedingExpiringSoonEmail(expiringSoonNotificationRows)
        for (const piece of expiringSoonPieceRows) {
          const userIds = usersByPiece.get(piece.id)
          if (!userIds || userIds.size === 0) {
            continue
          }
          void sendExpiringSoonEmails({
            serviceClient,
            supabaseUrl,
            serviceRoleKey: supabaseServiceRoleKey,
            piece,
            userIds,
          }).catch(() => undefined)
        }
      }
    }

    const { data: activeToExpire, error: activeToExpireError } = await serviceClient
      .from('gum_pieces')
      .select('id, creator_id, recipient_id, title, category, color_hex, created_at')
      .eq('status', 'active')
      .lt('expires_at', nowIso)

    if (activeToExpireError) {
      return jsonResponse(500, { error: activeToExpireError.message })
    }

    let expiredActiveCount = 0
    if ((activeToExpire ?? []).length > 0) {
      const pieceRows = activeToExpire as ActivePieceRow[]
      const pieceIds = pieceRows.map((piece) => piece.id)

      const { data: updatedActive, error: updateActiveError } = await serviceClient
        .from('gum_pieces')
        .update({ status: 'expired' })
        .in('id', pieceIds)
        .select('id')

      if (updateActiveError) {
        return jsonResponse(500, { error: updateActiveError.message })
      }

      expiredActiveCount = updatedActive?.length ?? pieceIds.length

      const graveyardRows = pieceRows.map((piece) => {
        const sortedPair = [piece.creator_id, piece.recipient_id].sort()
        return {
          gum_piece_id: piece.id,
          user_a_id: sortedPair[0],
          user_b_id: sortedPair[1],
          title: piece.title,
          category: piece.category,
          color_hex: piece.color_hex,
          created_at: piece.created_at,
          expired_at: nowIso,
        }
      })

      const { error: graveyardError } = await serviceClient
        .from('graveyard')
        .insert(graveyardRows)
      if (graveyardError) {
        return jsonResponse(500, { error: graveyardError.message })
      }

      const notificationRows = pieceRows.flatMap((piece) => {
        return [
          {
            user_id: piece.creator_id,
            type: 'plan_expired',
            reference_id: piece.id,
            read: false,
          },
          {
            user_id: piece.recipient_id,
            type: 'plan_expired',
            reference_id: piece.id,
            read: false,
          },
        ]
      })

      const { error: notificationError } = await serviceClient
        .from('notifications')
        .insert(notificationRows)
      if (notificationError) {
        return jsonResponse(500, { error: notificationError.message })
      }

      for (const piece of pieceRows) {
        void sendExpiryEmails({
          serviceClient,
          supabaseUrl,
          serviceRoleKey: supabaseServiceRoleKey,
          piece,
        }).catch(() => undefined)
      }
    }

    const { data: cleanedSessions, error: cleanupError } = await serviceClient
      .from('confirmation_sessions')
      .delete()
      .lt('expires_at', nowIso)
      .select('id')
    if (cleanupError) {
      return jsonResponse(500, { error: cleanupError.message })
    }

    return jsonResponse(200, {
      expired_placeholders: expiredPlaceholders?.length ?? 0,
      expiring_soon_notified: expiringSoonNotified,
      expired_active: expiredActiveCount,
      cleaned_sessions: cleanedSessions?.length ?? 0,
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

async function sendExpiringSoonEmails(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  piece: ExpiringSoonPieceRow
  userIds: Set<string>
}): Promise<void> {
  const { piece, userIds } = params
  const [creatorAuth, recipientAuth, creatorProfile, recipientProfile] = await Promise.all([
    params.serviceClient.auth.admin.getUserById(piece.creator_id),
    params.serviceClient.auth.admin.getUserById(piece.recipient_id),
    params.serviceClient
      .from('users')
      .select('display_name')
      .eq('id', piece.creator_id)
      .maybeSingle<{ display_name: string }>(),
    params.serviceClient
      .from('users')
      .select('display_name')
      .eq('id', piece.recipient_id)
      .maybeSingle<{ display_name: string }>(),
  ])

  const creatorEmail = creatorAuth.data.user?.email
  const recipientEmail = recipientAuth.data.user?.email
  const creatorName = creatorProfile.data?.display_name ?? 'Unknown user'
  const recipientName = recipientProfile.data?.display_name ?? 'Unknown user'

  const requests: Promise<Response>[] = []
  if (userIds.has(piece.creator_id) && creatorEmail) {
    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: creatorEmail,
          subject: 'A plan is expiring soon',
          body: `Your plan '${piece.title}' with ${recipientName} expires in the next 30 days. Open Sticky Bridges to confirm it before it expires.`,
        }),
      }),
    )
  }
  if (userIds.has(piece.recipient_id) && recipientEmail) {
    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          subject: 'A plan is expiring soon',
          body: `Your plan '${piece.title}' with ${creatorName} expires in the next 30 days. Open Sticky Bridges to confirm it before it expires.`,
        }),
      }),
    )
  }

  if (requests.length > 0) {
    await Promise.all(requests)
  }
}

async function sendExpiryEmails(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  piece: ActivePieceRow
}): Promise<void> {
  const { piece } = params
  const [creatorAuth, recipientAuth, creatorProfile, recipientProfile] = await Promise.all([
    params.serviceClient.auth.admin.getUserById(piece.creator_id),
    params.serviceClient.auth.admin.getUserById(piece.recipient_id),
    params.serviceClient
      .from('users')
      .select('display_name')
      .eq('id', piece.creator_id)
      .maybeSingle<{ display_name: string }>(),
    params.serviceClient
      .from('users')
      .select('display_name')
      .eq('id', piece.recipient_id)
      .maybeSingle<{ display_name: string }>(),
  ])

  const creatorEmail = creatorAuth.data.user?.email
  const recipientEmail = recipientAuth.data.user?.email
  const creatorName = creatorProfile.data?.display_name ?? 'Unknown user'
  const recipientName = recipientProfile.data?.display_name ?? 'Unknown user'

  const requests: Promise<Response>[] = []
  if (creatorEmail) {
    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: creatorEmail,
          subject: 'A plan expired',
          body: `Your plan '${piece.title}' with ${recipientName} expired without being confirmed. It's in your graveyard.`,
        }),
      }),
    )
  }
  if (recipientEmail) {
    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          subject: 'A plan expired',
          body: `Your plan '${piece.title}' with ${creatorName} expired without being confirmed. It's in your graveyard.`,
        }),
      }),
    )
  }

  if (requests.length > 0) {
    await Promise.all(requests)
  }
}
