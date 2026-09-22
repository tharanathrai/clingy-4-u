import { formatDistanceToNow } from 'date-fns'
import { Heart, X } from 'lucide-react'
import type { Notification, NotificationType } from '../../hooks/useNotifications.ts'
import { withAvatarSize } from '../../utils/avatar.ts'
import { getNotificationCopy } from '../../../supabase/functions/_shared/notificationCopy.ts'

const unreadBorderByType: Record<NotificationType, string> = {
  invite_received:    'border-accent',
  invite_accepted:    'border-active',
  invite_rejected:    'border-playful',
  plan_turned_down:   'border-playful',
  member_declined:    'border-playful',
  plan_expiring_soon: 'border-savor',
  plan_expired:       'border-text-3',
  bridge_formed:      'border-active',
  connection_request: 'border-explore',
  connection_accepted:'border-explore',
  post_reaction:      'border-support',
  post_comment:       'border-accent',
  plan_edit_proposed:  'border-savor',
  plan_edit_accepted:  'border-active',
  plan_edit_declined:  'border-playful',
  confirmation_started: 'border-accent',
}

interface NotificationWithActor extends Notification {
  actor_name?: string
  actor_avatar_url?: string | null
}

interface NotificationItemProps {
  notification: NotificationWithActor
  onPress: () => void
  /** Permanently removes the notification. Rendered as an X on the row's trailing edge. */
  onDismiss: () => void
}

export function NotificationItem({ notification, onPress, onDismiss }: NotificationItemProps) {
  const actorName = notification.actor_name ?? 'Unknown user'
  const copy = getNotificationCopy(notification.type, actorName, notification.actor_name)
  const timestamp = getTimestamp(notification.created_at)
  const isUnread = !notification.read
  const hideActor = notification.type === 'post_reaction'

  // Row is a div with two sibling buttons — a button can't nest a button.
  return (
    <div
      className={`flex w-full items-center rounded-md pr-1 ${isUnread ? `border-l-[3px] ${unreadBorderByType[notification.type] ?? 'border-accent'} bg-surface-2` : 'bg-surface'}`}
    >
      <button
        type="button"
        onClick={onPress}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-4 py-3 text-left transition-transform active:scale-[0.98]"
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
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-3 transition hover:bg-surface hover:text-text active:scale-90"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

function getTimestamp(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return 'just now'
  }

  return formatDistanceToNow(date, { addSuffix: true })
}
