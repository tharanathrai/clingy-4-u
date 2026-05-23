import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_rejected'
  | 'plan_turned_down'
  | 'plan_expiring_soon'
  | 'plan_expired'
  | 'bridge_formed'
  | 'post_comment'
  | 'post_reaction'
  | 'connection_request'
  | 'connection_accepted'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  reference_id: string
  read: boolean
  created_at: string
  actor_name?: string
  actor_avatar_url?: string | null
  target_user_id?: string | null
}

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  loading: boolean
  error: string | null
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data: notificationRows, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (notificationsError) {
    throw new Error('Something went wrong - try again.')
  }

  // post_reaction is intentionally excluded from the in-app list (PRD section 14)
  const filtered = ((notificationRows ?? []) as Notification[]).filter(
    (notification) => notification.type !== 'post_reaction',
  )

  return enrichNotifications(userId, filtered)
}

export function useNotifications(): UseNotificationsResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const qk = queryKeys.notifications(userId)

  const { data, isLoading, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchNotifications(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: 30 * 1000,
  })

  // Real-time: INSERT — enrich and prepend; UPDATE — patch in place
  useEffect(() => {
    if (!userId) return
    return subscribePostgresChannel(`notifications-rt-${userId}`, [
      {
        event: 'INSERT',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
        callback: (payload) => {
          const inserted = payload.new as Notification
          if (inserted.type === 'post_reaction') return
          void (async () => {
            const [enriched] = await enrichNotifications(userId, [inserted])
            queryClient.setQueryData<Notification[]>(
              qk,
              (current) => [enriched ?? inserted, ...(current ?? [])],
            )
          })()
        },
      },
      {
        event: 'UPDATE',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
        callback: (payload) => {
          const updated = payload.new as Notification
          queryClient.setQueryData<Notification[]>(
            qk,
            (current) =>
              (current ?? []).map((notification) =>
                notification.id === updated.id
                  ? {
                      ...updated,
                      actor_name: notification.actor_name,
                      actor_avatar_url: notification.actor_avatar_url,
                      target_user_id: notification.target_user_id,
                    }
                  : notification,
              ),
          )
        },
      },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, userId])

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', userId!)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<Notification[]>(qk)
      queryClient.setQueryData<Notification[]>(
        qk,
        (current) =>
          (current ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId!)
        .eq('read', false)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<Notification[]>(qk)
      queryClient.setQueryData<Notification[]>(
        qk,
        (current) => (current ?? []).map((n) => ({ ...n, read: true })),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId!)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk })
      const previous = queryClient.getQueryData<Notification[]>(qk)
      queryClient.setQueryData<Notification[]>(
        qk,
        (current) => (current ?? []).filter((n) => n.id !== id),
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk, context.previous)
      }
    },
  })

  const notifications = data ?? []

  const unreadCount = useMemo(
    () => notifications.reduce((count, n) => (n.read ? count : count + 1), 0),
    [notifications],
  )

  return {
    notifications,
    unreadCount,
    markAsRead: (id) => markAsReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllAsReadMutation.mutateAsync(),
    dismissNotification: (id) => dismissMutation.mutateAsync(id),
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
  }
}

async function enrichNotifications(
  userId: string,
  notifications: Notification[],
): Promise<Notification[]> {
  if (notifications.length === 0) {
    return notifications
  }

  const gumPieceIds = notifications
    .filter((n) =>
      n.type === 'invite_received' ||
      n.type === 'invite_accepted' ||
      n.type === 'invite_rejected' ||
      n.type === 'plan_turned_down' ||
      n.type === 'plan_expiring_soon' ||
      n.type === 'plan_expired',  // included so expiry notifications show actor name
    )
    .map((n) => n.reference_id)

  const bridgeIds = notifications
    .filter((n) => n.type === 'bridge_formed')
    .map((n) => n.reference_id)

  const connectionIds = notifications
    .filter((n) => n.type === 'connection_request' || n.type === 'connection_accepted')
    .map((n) => n.reference_id)

  const gumPiecesById = new Map<
    string,
    { id: string; creator_id: string; recipient_id: string }
  >()
  const bridgesById = new Map<
    string,
    { id: string; user_a_id: string; user_b_id: string }
  >()
  const connectionsById = new Map<
    string,
    { id: string; requested_by: string; user_a_id: string; user_b_id: string }
  >()

  if (gumPieceIds.length > 0) {
    const { data: gumPieces } = await supabase
      .from('gum_pieces')
      .select('id, creator_id, recipient_id')
      .in('id', gumPieceIds)
    for (const piece of gumPieces ?? []) {
      gumPiecesById.set(piece.id, {
        id: piece.id,
        creator_id: piece.creator_id,
        recipient_id: piece.recipient_id,
      })
    }
  }

  if (bridgeIds.length > 0) {
    const { data: bridges } = await supabase
      .from('bridges')
      .select('id, user_a_id, user_b_id')
      .in('id', bridgeIds)
    for (const bridge of bridges ?? []) {
      bridgesById.set(bridge.id, {
        id: bridge.id,
        user_a_id: bridge.user_a_id,
        user_b_id: bridge.user_b_id,
      })
    }
  }

  if (connectionIds.length > 0) {
    const { data: connections } = await supabase
      .from('connections')
      .select('id, requested_by, user_a_id, user_b_id')
      .in('id', connectionIds)
    for (const connection of connections ?? []) {
      connectionsById.set(connection.id, {
        id: connection.id,
        requested_by: connection.requested_by,
        user_a_id: connection.user_a_id,
        user_b_id: connection.user_b_id,
      })
    }
  }

  const actorIds = new Set<string>()
  for (const notification of notifications) {
    if (notification.type === 'post_reaction') {
      continue
    }
    const actorInfo = getActorAndTargetUserId(
      notification,
      userId,
      gumPiecesById,
      bridgesById,
      connectionsById,
    )
    if (actorInfo.actorId) {
      actorIds.add(actorInfo.actorId)
    }
  }

  const usersById = new Map<string, { display_name: string; avatar_url: string | null }>()
  if (actorIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', Array.from(actorIds))
    for (const row of users ?? []) {
      usersById.set(row.id, {
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      })
    }
  }

  return notifications.map((notification) => {
    if (notification.type === 'post_reaction') {
      return {
        ...notification,
        actor_name: undefined,
        actor_avatar_url: null,
        target_user_id: null,
      }
    }

    const actorInfo = getActorAndTargetUserId(
      notification,
      userId,
      gumPiecesById,
      bridgesById,
      connectionsById,
    )
    const actor = actorInfo.actorId ? usersById.get(actorInfo.actorId) : null
    return {
      ...notification,
      actor_name: actor?.display_name ?? notification.actor_name,
      actor_avatar_url: actor?.avatar_url ?? notification.actor_avatar_url ?? null,
      target_user_id: actorInfo.targetUserId ?? null,
    }
  })
}

function getActorAndTargetUserId(
  notification: Notification,
  userId: string,
  gumPiecesById: Map<string, { id: string; creator_id: string; recipient_id: string }>,
  bridgesById: Map<string, { id: string; user_a_id: string; user_b_id: string }>,
  connectionsById: Map<
    string,
    { id: string; requested_by: string; user_a_id: string; user_b_id: string }
  >,
): { actorId: string | null; targetUserId: string | null } {
  if (notification.type === 'bridge_formed') {
    const bridge = bridgesById.get(notification.reference_id)
    if (!bridge) {
      return { actorId: null, targetUserId: null }
    }
    const otherId = bridge.user_a_id === userId ? bridge.user_b_id : bridge.user_a_id
    return { actorId: otherId, targetUserId: otherId }
  }

  if (notification.type === 'connection_request') {
    const connection = connectionsById.get(notification.reference_id)
    return {
      actorId: connection?.requested_by ?? null,
      targetUserId: connection?.requested_by ?? null,
    }
  }

  if (notification.type === 'connection_accepted') {
    const connection = connectionsById.get(notification.reference_id)
    if (!connection) {
      return { actorId: null, targetUserId: null }
    }
    const accepterId =
      connection.user_a_id === connection.requested_by
        ? connection.user_b_id
        : connection.user_a_id
    return {
      actorId: accepterId,
      targetUserId: accepterId,
    }
  }

  const gumPiece = gumPiecesById.get(notification.reference_id)
  if (!gumPiece) {
    return { actorId: null, targetUserId: null }
  }
  const otherId = gumPiece.creator_id === userId ? gumPiece.recipient_id : gumPiece.creator_id
  return { actorId: otherId, targetUserId: otherId }
}
