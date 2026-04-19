import { formatDistanceToNow } from 'date-fns'
import type { Comment, User } from '../../types/index.ts'

interface CommentItemProps {
  comment: Comment & { user: User }
  onUserPress?: () => void
}

export function CommentItem({ comment, onUserPress }: CommentItemProps) {
  const timestamp = toRelativeTime(comment.created_at)

  return (
    <article className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={onUserPress}
        disabled={!onUserPress}
        className="disabled:cursor-default"
      >
        {comment.user.avatar_url ? (
          <img
            src={comment.user.avatar_url}
            alt={comment.user.display_name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs text-text-2">
            {comment.user.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onUserPress}
          disabled={!onUserPress}
          className="text-xs font-medium text-text disabled:cursor-default"
        >
          {comment.user.display_name}
        </button>
        <p className="mt-0.5 break-words text-sm text-text">{comment.body}</p>
        <p className="mt-1 text-xs text-text-3">{timestamp}</p>
      </div>
    </article>
  )
}

function toRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'just now'
  }
  return formatDistanceToNow(date, { addSuffix: true })
}
