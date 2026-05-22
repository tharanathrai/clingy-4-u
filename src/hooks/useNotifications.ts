import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'

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

const notificationsCache = new Map<string, Notification[]>()

export function useNotifications(): UseNotificationsResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelIdRef = useRef(crypto.randomUUID())

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      setError(null)
      return
    }

    const cached = notificationsCache.get(userId)
    if (cached) {
      setNotifications(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const { data: notificationRows, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (notificationsError) {
      setError('Something went wrong - try again.')
      setLoading(false)
      return
    }

    const nextNotifications = await enrichNotifications(
      userId,
      (notificationRows ?? []) as Notification[],
    )
    setError(null)
    notificationsCache.set(userId, nextNotifications)
    setNotifications(nextNotifications)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadNotifications()
  }, [authLoading, loadNotifications])

  useEffect(() => {
    if (!userId) {
      return
    }

    const channel = supabase
      .channel(`notifications-${userId}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const inserted = payload.new as Notification
          void (async () => {
            const [enriched] = await enrichNotifications(userId, [inserted])
            setNotifications((current) => {
              const next = [enriched ?? inserted, ...current]
              notificationsCache.set(userId, next)
              return next
            })
          })()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((current) => {
            const next = current.map((notification) =>
              notification.id === updated.id
                ? {
                    ...updated,
                    actor_name: notification.actor_name,
                    actor_avatar_url: notification.actor_avatar_url,
                    target_user_id: notification.target_user_id,
                  }
                : notification,
            )
            notificationsCache.set(userId, next)
            return next
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) {
        return
      }

      setNotifications((current) => {
        const next = current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        )
        notificationsCache.set(userId, next)
        return next
      })

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', userId)
    },
    [userId],
  )

  const markAllAsRead = useCallback(async () => {
    if (!userId) {
      return
    }

    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, read: true }))
      notificationsCache.set(userId, next)
      return next
    })

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
  }, [userId])

  const dismissNotification = useCallback(
    async (id: string) => {
      if (!userId) {
        return
      }

      setNotifications((current) => {
        const next = current.filter((notification) => notification.id !== id)
        notificationsCache.set(userId, next)
        return next
      })

      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
    },
    [userId],
  )

  const unreadCount = useMemo(() => {
    return notifications.reduce((count, notification) => {
      return notification.read ? count : count + 1
    }, 0)
  }, [notifications])

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    loading: loading || authLoading,
    error,
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
    .filter((notification) =>
      notification.type === 'invite_received' ||
      notification.type === 'invite_accepted' ||
      notification.type === 'invite_rejected' ||
      notification.type === 'plan_turned_down' ||
      notification.type === 'plan_expiring_soon',
    )
    .map((notification) => notification.reference_id)

  const bridgeIds = notifications
    .filter((notification) => notification.type === 'bridge_formed')
    .map((notification) => notification.reference_id)

  const connectionIds = notifications
    .filter((notification) =>
      notification.type === 'connection_request' ||
      notification.type === 'connection_accepted',
    )
    .map((notification) => notification.reference_id)

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
