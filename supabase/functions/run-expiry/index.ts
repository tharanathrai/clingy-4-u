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
  title: string
  category: string
  color_hex: string
  created_at: string
  member_ids: string[]
}

interface ExpiringSoonPieceRow {
  id: string
  title: string
  member_ids: string[]
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

    // Expire placeholder pieces
    const { data: expiredPlaceholders, error: placeholderError } = await serviceClient
      .from('gum_pieces')
      .update({ status: 'expired' })
      .eq('status', 'placeholder')
      .lt('expires_at', nowIso)
      .select('id')

    if (placeholderError) {
      return jsonResponse(500, { error: placeholderError.message })
    }

    // Expiring-soon notifications
    const { windowStartIso, windowEndIso } = getExpiringSoonWindow(new Date(nowIso))

    const { data: expiringSoonPiecesRaw, error: expiringSoonError } = await serviceClient
      .from('gum_pieces')
      .select('id, title')
      .eq('status', 'active')
      .gt('expires_at', windowStartIso)
      .lte('expires_at', windowEndIso)

    if (expiringSoonError) {
      return jsonResponse(500, { error: expiringSoonError.message })
    }

    const expiringSoonPieceRows = expiringSoonPiecesRaw ?? []
    let expiringSoonNotified = 0

    if (expiringSoonPieceRows.length > 0) {
      // Fetch member IDs for expiring-soon pieces
      const expiringSoonPieceIds = expiringSoonPieceRows.map((p: { id: string }) => p.id)
      const { data: expiringSoonMembers } = await serviceClient
        .from('gum_piece_members')
        .select('gum_piece_id, user_id')
        .in('gum_piece_id', expiringSoonPieceIds)
        .eq('status', 'accepted')

      const membersByPiece = groupByPiece(expiringSoonMembers ?? [])

      const piecesForNotify: ExpiringSoonPieceRow[] = expiringSoonPieceRows.map(
        (p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
          member_ids: membersByPiece.get(p.id) ?? [],
        }),
      )

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
        piecesForNotify,
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
        for (const piece of piecesForNotify) {
          const userIds = usersByPiece.get(piece.id)
          if (!userIds || userIds.size === 0) continue
          void sendExpiringSoonEmails({
            serviceClient,
            supabaseUrl,
            serviceRoleKey: supabaseServiceRoleKey,
            piece,
            userIds,
            membersByPiece,
          }).catch(() => undefined)
        }
      }
    }

    // Expire active pieces
    const { data: activeToExpire, error: activeToExpireError } = await serviceClient
      .from('gum_pieces')
      .select('id, creator_id, title, category, color_hex, created_at')
      .eq('status', 'active')
      .lt('expires_at', nowIso)

    if (activeToExpireError) {
      return jsonResponse(500, { error: activeToExpireError.message })
    }

    let expiredActiveCount = 0
    if ((activeToExpire ?? []).length > 0) {
      const pieceIds = (activeToExpire ?? []).map((p: { id: string }) => p.id)

      // Fetch member IDs for expiring pieces
      const { data: expiryMembers } = await serviceClient
        .from('gum_piece_members')
        .select('gum_piece_id, user_id')
        .in('gum_piece_id', pieceIds)
        .eq('status', 'accepted')

      const membersByPiece = groupByPiece(expiryMembers ?? [])

      const { data: updatedActive, error: updateActiveError } = await serviceClient
        .from('gum_pieces')
        .update({ status: 'expired' })
        .in('id', pieceIds)
        .select('id')

      if (updateActiveError) {
        return jsonResponse(500, { error: updateActiveError.message })
      }

      expiredActiveCount = updatedActive?.length ?? pieceIds.length

      // Build graveyard rows
      const graveyardRows = (activeToExpire ?? []).map((piece: { id: string; creator_id: string; title: string; category: string; color_hex: string; created_at: string }) => {
        const memberIds = membersByPiece.get(piece.id) ?? [piece.creator_id]
        const sortedPair = memberIds.slice(0, 2).sort()
        return {
          gum_piece_id: piece.id,
          user_a_id: sortedPair[0] ?? piece.creator_id,
          user_b_id: sortedPair[1] ?? sortedPair[0] ?? piece.creator_id,
          member_ids: memberIds,
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

      // Notify all members
      const notificationRows = (activeToExpire ?? []).flatMap((piece: { id: string }) => {
        const memberIds = membersByPiece.get(piece.id) ?? []
        return memberIds.map((userId) => ({
          user_id: userId,
          type: 'plan_expired',
          reference_id: piece.id,
          read: false,
        }))
      })

      if (notificationRows.length > 0) {
        const { error: notificationError } = await serviceClient
          .from('notifications')
          .insert(notificationRows)
        if (notificationError) {
          return jsonResponse(500, { error: notificationError.message })
        }
      }

      // Fire expiry emails for all members
      for (const piece of (activeToExpire ?? []) as ActivePieceRow[]) {
        const memberIds = membersByPiece.get(piece.id) ?? []
        void sendExpiryEmails({
          serviceClient,
          supabaseUrl,
          serviceRoleKey: supabaseServiceRoleKey,
          piece: { ...piece, member_ids: memberIds },
        }).catch(() => undefined)
      }
    }

    // Cleanup expired sessions
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

function groupByPiece(rows: { gum_piece_id: string; user_id: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const existing = map.get(row.gum_piece_id) ?? []
    existing.push(row.user_id)
    map.set(row.gum_piece_id, existing)
  }
  return map
}

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
  membersByPiece: Map<string, string[]>
}): Promise<void> {
  const { piece, userIds } = params
  const allMemberIds = piece.member_ids

  const [authResults, profileResults] = await Promise.all([
    Promise.all(allMemberIds.map((id) => params.serviceClient.auth.admin.getUserById(id))),
    params.serviceClient.from('users').select('id, display_name').in('id', allMemberIds),
  ])

  const emailById = new Map(
    authResults.map((r, i) => [allMemberIds[i], r.data.user?.email]),
  )
  const nameById = new Map(
    ((profileResults.data ?? []) as { id: string; display_name: string }[]).map((u) => [
      u.id,
      u.display_name,
    ]),
  )

  const requests: Promise<Response>[] = []
  for (const userId of userIds) {
    const email = emailById.get(userId)
    if (!email) continue
    const othersNames = allMemberIds
      .filter((id) => id !== userId)
      .map((id) => nameById.get(id) ?? 'someone')
      .join(', ')

    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: email,
          subject: 'A plan is expiring soon',
          body: `Your plan '${piece.title}' with ${othersNames} expires in the next 30 days. Open the app to confirm it before it expires.`,
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
  const allMemberIds = piece.member_ids

  const [authResults, profileResults] = await Promise.all([
    Promise.all(allMemberIds.map((id) => params.serviceClient.auth.admin.getUserById(id))),
    params.serviceClient.from('users').select('id, display_name').in('id', allMemberIds),
  ])

  const emailById = new Map(
    authResults.map((r, i) => [allMemberIds[i], r.data.user?.email]),
  )
  const nameById = new Map(
    ((profileResults.data ?? []) as { id: string; display_name: string }[]).map((u) => [
      u.id,
      u.display_name,
    ]),
  )

  const requests: Promise<Response>[] = []
  for (const userId of allMemberIds) {
    const email = emailById.get(userId)
    if (!email) continue
    const othersNames = allMemberIds
      .filter((id) => id !== userId)
      .map((id) => nameById.get(id) ?? 'someone')
      .join(', ')

    requests.push(
      fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: email,
          subject: 'A plan expired',
          body: `Your plan '${piece.title}' with ${othersNames} expired without being confirmed. It's in your graveyard.`,
        }),
      }),
    )
  }

  if (requests.length > 0) {
    await Promise.all(requests)
  }
}
