import { formatDistanceToNow } from 'date-fns'
import { Heart } from 'lucide-react'
import type { Notification } from '../../hooks/useNotifications.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface NotificationWithActor extends Notification {
  actor_name?: string
  actor_avatar_url?: string | null
}

interface NotificationItemProps {
  notification: NotificationWithActor
  onPress: () => void
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const actorName = notification.actor_name ?? 'Unknown user'
  const copy = getNotificationCopy(notification.type, actorName)
  const timestamp = getTimestamp(notification.created_at)
  const isUnread = !notification.read
  const hideActor = notification.type === 'post_reaction'

  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-opacity active:opacity-90 ${isUnread ? 'border-l-[3px] border-accent bg-surface-2' : 'bg-surface'}`}
    >
      {hideActor ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-accent">
          <Heart size={18} strokeWidth={1.75} fill="currentColor" />
        </div>
      ) : notification.actor_avatar_url ? (
        <img
          src={
            withAvatarSize(notification.actor_avatar_url, 48) ??
            notification.actor_avatar_url
          }
          alt={actorName}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-text-2">
          {actorName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm text-text ${isUnread ? 'font-medium' : ''}`}>{copy}</p>
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
  if (type === 'plan_expired') {
    return 'A plan expired'
  }
  if (type === 'bridge_formed') {
    return `You formed a bridge with ${name}`
  }
  if (type === 'connection_request') {
    return `${name} wants to connect`
  }
  if (type === 'connection_accepted') {
    return `${name} accepted your connection request`
  }
  if (type === 'post_reaction') {
    return 'Someone reacted to your post'
  }
  if (type === 'post_comment') {
    return `${name} commented on your post`
  }

  return 'You have a new notification'
}
