import { CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout.tsx'
import { iconButtonClassName } from '../lib/iconButton.ts'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { NotificationItem } from '../components/notifications/NotificationItem.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { ConnectionRequestSheet } from '../components/connections/ConnectionRequestSheet.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useNotifications } from '../hooks/useNotifications.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { useScrollRestore } from '../hooks/useScrollRestore.ts'
import { invalidateConnectionFlow, invalidateNotifications } from '../lib/invalidate.ts'
import { resolveStaleGumPieceTap, routesToGumPiece } from '../lib/notificationRouting.ts'
import { supabase } from '../lib/supabase.ts'

export default function Notifications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, loading, error } =
    useNotifications()
  const [toast, setToast] = useState<string | null>(null)
  const [activeConnectionRequest, setActiveConnectionRequest] = useState<{
    connectionId: string
    notificationId: string
  } | null>(null)
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

    if (type === 'connection_request') {
      setActiveConnectionRequest({
        connectionId: referenceId,
        notificationId: id,
      })
      return
    }
    if (routesToGumPiece(type)) {
      const { data: pieceRow } = await supabase
        .from('gum_pieces')
        .select('status')
        .eq('id', referenceId)
        .maybeSingle<{ status: string }>()

      const staleTap = resolveStaleGumPieceTap(type, pieceRow?.status)
      if (staleTap.dismiss) {
        await dismissNotification(id)
        setToast(staleTap.toast)
        return
      }

      void navigate(`/piece/${referenceId}`)
      return
    }

    if (type === 'bridge_formed') {
      void navigate('/network', {
        state: tappedNotification?.target_user_id
          ? { selectUserId: tappedNotification.target_user_id }
          : undefined,
      })
      return
    }

    if (type === 'connection_accepted') {
      void navigate('/network', {
        state: tappedNotification?.target_user_id
          ? { selectUserId: tappedNotification.target_user_id }
          : undefined,
      })
      return
    }

    if (type === 'post_comment' || type === 'post_reaction') {
      void navigate('/feed')
    }
  }

  return (
    <Layout>
      <main>
        <div className="flex items-center justify-between gap-3">
          <h1 className="app-page-title">updates</h1>
          {unreadCount > 0 ? (
            <button
              type="button"
              className={iconButtonClassName}
              aria-label="Mark all as read"
              onClick={() => void markAllAsRead()}
            >
              <CheckCheck size={18} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>

        {loading ? (
          <section className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-14 rounded-lg" />
            ))}
          </section>
        ) : null}

        {!loading && error ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-playful">{error}</p>
            <button
              type="button"
              onClick={() => { invalidateNotifications(user?.id, queryClient) }}
              className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && notifications.length === 0 ? (
          <section className="mt-8 text-center">
            <EmptyStateIllustration />
            <p className="font-display text-2xl text-text">All caught up.</p>
          </section>
        ) : null}

        {!loading && !error && notifications.length > 0 ? (
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

        {!loading && !error && hasMore ? (
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
      <ConnectionRequestSheet
        connectionId={activeConnectionRequest?.connectionId ?? null}
        onClose={() => setActiveConnectionRequest(null)}
        onResolved={({ action, otherUserId }) => {
          const activeRequest = activeConnectionRequest
          setActiveConnectionRequest(null)

          if (!activeRequest) {
            return
          }

          if (action === 'invalid') {
            void dismissNotification(activeRequest.notificationId)
            setToast('This request is no longer available.')
            return
          }

          if (action === 'reject') {
            void dismissNotification(activeRequest.notificationId)
            setToast('Request declined.')
            return
          }

          void dismissNotification(activeRequest.notificationId)
          invalidateConnectionFlow(user?.id, queryClient)
          setToast('Connection accepted.')
          if (otherUserId) {
            void navigate('/network', { state: { selectUserId: otherUserId } })
          }
        }}
      />
    </Layout>
  )
}
