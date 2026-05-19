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

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  reference_id: string
  read: boolean
  created_at: string
}

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  loading: boolean
}

const notificationsCache = new Map<string, Notification[]>()

export function useNotifications(): UseNotificationsResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const channelIdRef = useRef(crypto.randomUUID())

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const cached = notificationsCache.get(userId)
    if (cached) {
      setNotifications(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const nextNotifications = (data ?? []) as Notification[]
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
          setNotifications((current) => {
            const next = [inserted, ...current]
            notificationsCache.set(userId, next)
            return next
          })
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
              notification.id === updated.id ? updated : notification,
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
  }
}
