import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '../../hooks/useNotifications.ts'

interface NotificationWithActor extends Notification {
  actor_name?: string
  actor_avatar_url?: string | null
}

interface NotificationItemProps {
  notification: NotificationWithActor
  onPress: () => void
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const actorName = notification.actor_name ?? 'Someone'
  const copy = getNotificationCopy(notification.type, actorName)
  const timestamp = getTimestamp(notification.created_at)
  const isUnread = !notification.read

  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-opacity active:opacity-90 ${isUnread ? 'border-l-2 border-accent bg-surface-2' : 'bg-surface'}`}
    >
      {notification.actor_avatar_url ? (
        <img
          src={notification.actor_avatar_url}
          alt={actorName}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-text-2">
          {actorName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{copy}</p>
        <p className="mt-1 text-xs text-text-3">{timestamp}</p>
      </div>
    </button>
  )
}

function getTimestamp(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return 'just now'
  }

  return formatDistanceToNow(date, { addSuffix: true })
}

function getNotificationCopy(type: Notification['type'], name: string): string {
  if (type === 'invite_received') {
    return `${name} wants to make a plan with you`
  }
  if (type === 'invite_accepted') {
    return `${name} accepted your plan`
  }
  if (type === 'invite_rejected') {
    return `${name} passed on your plan`
  }
  if (type === 'plan_turned_down') {
    return `${name} turned down a plan`
  }
  if (type === 'plan_expiring_soon') {
    return 'A plan is expiring soon'
  }
  if (type === 'bridge_formed') {
    return 'You formed a bridge!'
  }
  if (type === 'connection_request') {
    return `${name} wants to connect`
  }

  return 'You have a new notification'
}
