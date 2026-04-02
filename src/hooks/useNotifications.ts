import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_rejected'
  | 'plan_turned_down'
  | 'plan_expiring_soon'
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
  loading: boolean
}

export function useNotifications(): UseNotificationsResult {
  const { user, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const channelIdRef = useRef(crypto.randomUUID())

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadNotifications()
  }, [authLoading, loadNotifications])

  useEffect(() => {
    if (!user) {
      return
    }

    const channel = supabase
      .channel(`notifications-${user.id}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const inserted = payload.new as Notification
          setNotifications((current) => [inserted, ...current])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === updated.id ? updated : notification,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) {
        return
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      )

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)
    },
    [user],
  )

  const markAllAsRead = useCallback(async () => {
    if (!user) {
      return
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    )

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }, [user])

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
    loading: loading || authLoading,
  }
}
