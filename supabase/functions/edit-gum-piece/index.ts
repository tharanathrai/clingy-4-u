import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { categories } from '../_shared/categorize.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_CATEGORY_SLUGS = new Set(categories.map((c) => c.slug))
const TITLE_MAX = 60

interface EditGumPieceBody {
  gum_piece_id?: string
  action?: 'propose' | 'accept_edit' | 'decline_edit'
  title?: string
  category?: string
  planned_date?: string | null
}

interface PendingEdit {
  title?: string
  category?: string
  planned_date?: string | null
  proposed_by: string
  proposed_at: string
  accepted_by: string[]
}

type GumPieceRow = {
  id: string
  creator_id: string
  title: string
  category: string
  planned_date: string | null
  status: 'placeholder' | 'active' | 'confirmed' | 'expired' | 'turned_down'
  pending_edit: PendingEdit | null
}

type MemberRow = {
  id: string
  user_id: string
  role: 'creator' | 'invitee'
  status: 'pending' | 'accepted' | 'declined'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return jsonResponse(401, { error: 'Missing authorization header.' })

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return jsonResponse(401, { error: 'Missing bearer token.' })

    const body = (await request.json()) as EditGumPieceBody
    const gumPieceId = body.gum_piece_id?.trim()
    const action = body.action

    if (!gumPieceId) return jsonResponse(400, { error: 'gum_piece_id_required' })
    if (!action || !['propose', 'accept_edit', 'decline_edit'].includes(action)) {
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

    const [pieceResult, memberResult] = await Promise.all([
      serviceClient
        .from('gum_pieces')
        .select('id, creator_id, title, category, planned_date, status, pending_edit')
        .eq('id', gumPieceId)
        .maybeSingle<GumPieceRow>(),
      serviceClient
        .from('gum_piece_members')
        .select('id, user_id, role, status')
        .eq('gum_piece_id', gumPieceId)
        .eq('user_id', userId)
        .maybeSingle<MemberRow>(),
    ])

    if (pieceResult.error) return jsonResponse(500, { error: pieceResult.error.message })
    if (!pieceResult.data) return jsonResponse(404, { error: 'gum_piece_not_found' })
    if (memberResult.error) return jsonResponse(500, { error: memberResult.error.message })
    if (!memberResult.data) return jsonResponse(403, { error: 'forbidden' })

    const piece = pieceResult.data
    const myMember = memberResult.data

    if (action === 'propose') {
      return handlePropose({ serviceClient, piece, myMember, userId, body, supabaseUrl, supabaseServiceRoleKey })
    }

    if (action === 'accept_edit') {
      return handleAcceptEdit({ serviceClient, piece, myMember, userId })
    }

    return handleDeclineEdit({ serviceClient, piece, myMember, userId })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

async function handlePropose(params: {
  serviceClient: ReturnType<typeof createClient>
  piece: GumPieceRow
  myMember: MemberRow
  userId: string
  body: EditGumPieceBody
  supabaseUrl: string
  supabaseServiceRoleKey: string
}): Promise<Response> {
  const { serviceClient, piece, myMember, userId, body, supabaseUrl, supabaseServiceRoleKey } = params

  if (piece.status !== 'placeholder' && piece.status !== 'active') {
    return jsonResponse(400, { error: 'invalid_status' })
  }

  // Only creator can edit placeholder (invitees haven't committed)
  if (piece.status === 'placeholder' && myMember.role !== 'creator') {
    return jsonResponse(403, { error: 'forbidden' })
  }

  // Validate proposed fields
  const newTitle = body.title?.trim()
  const newCategory = body.category
  const newPlannedDate = body.planned_date

  if (newTitle !== undefined && (newTitle.length === 0 || newTitle.length > TITLE_MAX)) {
    return jsonResponse(400, { error: 'title_invalid' })
  }
  if (newCategory !== undefined && !VALID_CATEGORY_SLUGS.has(newCategory)) {
    return jsonResponse(400, { error: 'category_invalid' })
  }
  if (newPlannedDate !== undefined && newPlannedDate !== null) {
    const d = new Date(newPlannedDate + 'T00:00:00Z')
    const now = Date.now()
    const oneYearMs = 365 * 24 * 60 * 60 * 1000
    if (isNaN(d.getTime()) || d.getTime() < now - 86400000 || d.getTime() > now + oneYearMs) {
      return jsonResponse(400, { error: 'planned_date_invalid' })
    }
  }

  // At least one field must change
  const titleChanges = newTitle !== undefined && newTitle !== piece.title
  const categoryChanges = newCategory !== undefined && newCategory !== piece.category
  const dateChanges = newPlannedDate !== undefined && newPlannedDate !== piece.planned_date
  if (!titleChanges && !categoryChanges && !dateChanges) {
    return jsonResponse(400, { error: 'no_changes' })
  }

  // For placeholder: apply directly, no re-acceptance needed
  if (piece.status === 'placeholder') {
    const updates: Record<string, unknown> = {}
    if (titleChanges) updates.title = newTitle
    if (categoryChanges) {
      updates.category = newCategory
      const cat = categories.find((c) => c.slug === newCategory)
      if (cat) updates.color_hex = cat.color_hex
    }
    if (dateChanges) updates.planned_date = newPlannedDate ?? null

    const { data: updatedPiece, error: updateError } = await serviceClient
      .from('gum_pieces')
      .update(updates)
      .eq('id', piece.id)
      .select('*')
      .single()

    if (updateError || !updatedPiece) {
      return jsonResponse(500, { error: updateError?.message ?? 'Failed to update piece.' })
    }

    return jsonResponse(200, { success: true, gum_piece: updatedPiece })
  }

  // For active: create proposal (one at a time)
  if (piece.pending_edit) {
    return jsonResponse(400, { error: 'edit_already_pending' })
  }

  const pendingEdit: PendingEdit = {
    proposed_by: userId,
    proposed_at: new Date().toISOString(),
    accepted_by: [],
    ...(titleChanges ? { title: newTitle } : {}),
    ...(categoryChanges ? { category: newCategory } : {}),
    ...(dateChanges ? { planned_date: newPlannedDate ?? null } : {}),
  }

  const { data: updatedPiece, error: updateError } = await serviceClient
    .from('gum_pieces')
    .update({ pending_edit: pendingEdit })
    .eq('id', piece.id)
    .select('*')
    .single()

  if (updateError || !updatedPiece) {
    return jsonResponse(500, { error: updateError?.message ?? 'Failed to save proposal.' })
  }

  // Notify all other accepted members
  const [otherMembersResult, actorResult] = await Promise.all([
    serviceClient
      .from('gum_piece_members')
      .select('user_id')
      .eq('gum_piece_id', piece.id)
      .eq('status', 'accepted')
      .neq('user_id', userId),
    serviceClient
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
  ])
  const otherMembers = otherMembersResult.data
  const actorName = actorResult.data?.display_name ?? null
  const actorAvatarUrl = actorResult.data?.avatar_url ?? null

  if ((otherMembers ?? []).length > 0) {
    const notifications = (otherMembers ?? []).map((m: { user_id: string }) => ({
      user_id: m.user_id,
      type: 'plan_edit_proposed',
      reference_id: piece.id,
      read: false,
      actor_name: actorName,
      actor_avatar_url: actorAvatarUrl,
    }))
    await serviceClient.from('notifications').insert(notifications)
  }

  void sendEditProposedEmail({
    serviceClient,
    supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
    proposerUserId: userId,
    otherMembers: (otherMembers ?? []).map((m: { user_id: string }) => m.user_id),
    title: piece.title,
    changes: pendingEdit,
  }).catch(() => undefined)

  return jsonResponse(200, { success: true, gum_piece: updatedPiece })
}

async function handleAcceptEdit(params: {
  serviceClient: ReturnType<typeof createClient>
  piece: GumPieceRow
  myMember: MemberRow
  userId: string
}): Promise<Response> {
  const { serviceClient, piece, myMember, userId } = params

  if (piece.status !== 'active') return jsonResponse(400, { error: 'invalid_status' })
  if (!piece.pending_edit) return jsonResponse(400, { error: 'no_pending_edit' })
  if (piece.pending_edit.proposed_by === userId) return jsonResponse(400, { error: 'cannot_accept_own_proposal' })
  if (myMember.status !== 'accepted') return jsonResponse(403, { error: 'forbidden' })

  const alreadyAccepted = piece.pending_edit.accepted_by.includes(userId)
  if (alreadyAccepted) return jsonResponse(400, { error: 'already_responded' })

  const updatedAcceptedBy = [...piece.pending_edit.accepted_by, userId]

  // Get all accepted members who need to accept (excluding proposer)
  const { data: requiredMembers } = await serviceClient
    .from('gum_piece_members')
    .select('user_id')
    .eq('gum_piece_id', piece.id)
    .eq('status', 'accepted')
    .neq('user_id', piece.pending_edit.proposed_by)

  const requiredIds = (requiredMembers ?? []).map((m: { user_id: string }) => m.user_id)
  const allAccepted = requiredIds.every((id: string) => updatedAcceptedBy.includes(id))

  if (!allAccepted) {
    // Save progress — not all accepted yet
    const updatedEdit: PendingEdit = { ...piece.pending_edit, accepted_by: updatedAcceptedBy }
    const { error: saveError } = await serviceClient
      .from('gum_pieces')
      .update({ pending_edit: updatedEdit })
      .eq('id', piece.id)

    if (saveError) return jsonResponse(500, { error: saveError.message })
    return jsonResponse(200, { success: true, applied: false })
  }

  // All accepted — apply the edit
  const edit = piece.pending_edit
  const updates: Record<string, unknown> = { pending_edit: null }
  if (edit.title !== undefined) updates.title = edit.title
  if (edit.category !== undefined) {
    updates.category = edit.category
    const cat = categories.find((c) => c.slug === edit.category)
    if (cat) updates.color_hex = cat.color_hex
  }
  if (edit.planned_date !== undefined) {
    updates.planned_date = edit.planned_date ?? null
    // Update expires_at if planned_date changes
    if (edit.planned_date) {
      const d = new Date(edit.planned_date + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      updates.expires_at = d.toISOString()
    } else {
      // Cleared planned_date: reset to 1yr from accepted_at
      updates.expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const { data: updatedPiece, error: applyError } = await serviceClient
    .from('gum_pieces')
    .update(updates)
    .eq('id', piece.id)
    .select('*')
    .single()

  if (applyError || !updatedPiece) {
    return jsonResponse(500, { error: applyError?.message ?? 'Failed to apply edit.' })
  }

  // Notify all members (incl. proposer) that edit was applied
  const { data: allMembers } = await serviceClient
    .from('gum_piece_members')
    .select('user_id')
    .eq('gum_piece_id', piece.id)
    .eq('status', 'accepted')

  if ((allMembers ?? []).length > 0) {
    const notifications = (allMembers ?? []).map((m: { user_id: string }) => ({
      user_id: m.user_id,
      type: 'plan_edit_accepted',
      reference_id: piece.id,
      read: false,
    }))
    await serviceClient.from('notifications').insert(notifications)
  }

  return jsonResponse(200, { success: true, applied: true, gum_piece: updatedPiece })
}

async function handleDeclineEdit(params: {
  serviceClient: ReturnType<typeof createClient>
  piece: GumPieceRow
  myMember: MemberRow
  userId: string
}): Promise<Response> {
  const { serviceClient, piece, myMember, userId } = params

  if (piece.status !== 'active') return jsonResponse(400, { error: 'invalid_status' })
  if (!piece.pending_edit) return jsonResponse(400, { error: 'no_pending_edit' })
  if (piece.pending_edit.proposed_by === userId) return jsonResponse(400, { error: 'cannot_decline_own_proposal' })
  if (myMember.status !== 'accepted') return jsonResponse(403, { error: 'forbidden' })

  const { data: updatedPiece, error: clearError } = await serviceClient
    .from('gum_pieces')
    .update({ pending_edit: null })
    .eq('id', piece.id)
    .select('*')
    .single()

  if (clearError || !updatedPiece) {
    return jsonResponse(500, { error: clearError?.message ?? 'Failed to decline edit.' })
  }

  // Notify proposer
  await serviceClient.from('notifications').insert({
    user_id: piece.pending_edit.proposed_by,
    type: 'plan_edit_declined',
    reference_id: piece.id,
    read: false,
  })

  return jsonResponse(200, { success: true, gum_piece: updatedPiece })
}

async function sendEditProposedEmail(params: {
  serviceClient: ReturnType<typeof createClient>
  supabaseUrl: string
  serviceRoleKey: string
  proposerUserId: string
  otherMembers: string[]
  title: string
  changes: PendingEdit
}): Promise<void> {
  const { serviceClient, supabaseUrl, serviceRoleKey, proposerUserId, otherMembers, title, changes } = params

  const { data: proposerProfile } = await serviceClient
    .from('users')
    .select('display_name')
    .eq('id', proposerUserId)
    .maybeSingle<{ display_name: string }>()

  const proposerName = proposerProfile?.display_name ?? 'Someone'

  const changeSummary = [
    changes.title ? `title → "${changes.title}"` : null,
    changes.category ? `category → ${changes.category}` : null,
    changes.planned_date !== undefined
      ? changes.planned_date
        ? `date → ${changes.planned_date}`
        : 'date cleared'
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  for (const recipientUserId of otherMembers) {
    const { data: authData } = await serviceClient.auth.admin.getUserById(recipientUserId)
    const recipientEmail = authData.user?.email
    if (!recipientEmail) continue

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: 'Someone wants to change a plan',
        body: `${proposerName} proposed changes to '${title}': ${changeSummary}. Open the app to accept or decline.`,
      }),
    })
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
