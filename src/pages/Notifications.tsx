import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout.tsx'
import { useNavigate } from 'react-router-dom'
import { NotificationItem } from '../components/notifications/NotificationItem.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useNotifications } from '../hooks/useNotifications.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { useScrollRestore } from '../hooks/useScrollRestore.ts'
import { supabase } from '../lib/supabase.ts'

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, loading } =
    useNotifications()
  const [toast, setToast] = useState<string | null>(null)
  const {
    visibleItems: visibleNotifications,
    hasMore,
    loadMore,
  } = usePaginatedItems(notifications, 6, 'pagination:/notifications')
  useScrollRestore(
    'scroll:/notifications',
    `${loading ? 'loading' : 'ready'}:${visibleNotifications.length}`,
  )

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  const handleNotificationPress = async (id: string, type: string, referenceId: string) => {
    const tappedNotification = notifications.find((notification) => notification.id === id)
    await markAsRead(id)

    if (type === 'invite_received') {
      const { data: pieceRow } = await supabase
        .from('gum_pieces')
        .select('status')
        .eq('id', referenceId)
        .maybeSingle<{ status: string }>()

      if (pieceRow?.status === 'expired') {
        await dismissNotification(id)
        setToast('This invite has expired.')
        return
      }
    }

    if (type === 'connection_request') {
      void navigate('/connections/requests')
      return
    }
    if (
      type === 'invite_received' ||
      type === 'invite_accepted' ||
      type === 'invite_rejected' ||
      type === 'plan_turned_down' ||
      type === 'plan_expiring_soon'
    ) {
      void navigate(`/piece/${referenceId}`)
    }

    if (type === 'bridge_formed') {
      void navigate('/network', {
        state: tappedNotification?.target_user_id
          ? { selectUserId: tappedNotification.target_user_id }
          : undefined,
      })
    }
  }

  return (
    <Layout>
      <main className="pb-24">
        <div className="flex items-start justify-between gap-3">
          <h1 className="app-page-title">notifications</h1>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-sm text-text-2"
              onClick={() => void markAllAsRead()}
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        {loading ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Loading notifications...</p>
          </section>
        ) : null}

        {!loading && notifications.length === 0 ? (
          <section className="mt-8 text-center">
            <EmptyStateIllustration />
            <p className="font-display text-2xl text-text">All caught up.</p>
          </section>
        ) : null}

        {!loading && notifications.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {visibleNotifications.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onPress={() =>
                    void handleNotificationPress(
                      notification.id,
                      notification.type,
                      notification.reference_id,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              className="rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Load more
            </button>
          </div>
        ) : null}

        {toast ? (
          <div className="app-fixed-frame safe-bottom-24 px-5">
            <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
              {toast}
            </p>
          </div>
        ) : null}
      </main>
    </Layout>
  )
}
