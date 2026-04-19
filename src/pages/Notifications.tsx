import { Layout } from '../components/layout/Layout.tsx'
import { useNavigate } from 'react-router-dom'
import { NotificationItem } from '../components/notifications/NotificationItem.tsx'
import { useNotifications } from '../hooks/useNotifications.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotifications()
  const {
    visibleItems: visibleNotifications,
    hasMore,
    loadMore,
  } = usePaginatedItems(notifications, 6)

  const handleNotificationPress = async (id: string, type: string, referenceId: string) => {
    await markAsRead(id)
    if (type === 'connection_request') {
      void navigate('/connections/requests')
      return
    }
    if (
      type === 'invite_received' ||
      type === 'invite_accepted' ||
      type === 'invite_rejected' ||
      type === 'plan_turned_down' ||
      type === 'plan_expiring_soon' ||
      type === 'bridge_formed'
    ) {
      void navigate(`/piece/${referenceId}`)
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
      </main>
    </Layout>
  )
}
