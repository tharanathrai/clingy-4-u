import { formatDistanceToNow } from 'date-fns'
import { Heart, MessageCircle } from 'lucide-react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, Post, User } from '../../types/index.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface FeedPostCardProps {
  post: Post & {
    author: User
    bridge: Bridge
    otherParticipantName?: string
    reactionCount: number
    commentCount: number
    hasReacted: boolean
  }
  onReact: () => void
  onComment: () => void
  onAuthorPress?: () => void
  onOtherParticipantPress?: () => void
  hideActions?: boolean
}

const categoryStripClass: Record<CategorySlug, string> = {
  intimate: 'bg-intimate',
  active: 'bg-active',
  playful: 'bg-playful',
  explore: 'bg-explore',
  recharge: 'bg-recharge',
  savor: 'bg-savor',
  support: 'bg-support',
}

export function FeedPostCard({
  post,
  onReact,
  onComment,
  onAuthorPress,
  onOtherParticipantPress,
  hideActions = false,
}: FeedPostCardProps) {
  const category = toCategorySlug(post.bridge.category)
  const timestamp = toRelativeTimestamp(post.created_at)

  return (
    <article className="overflow-hidden rounded-lg bg-surface shadow-card">
      <div className={`h-1 w-full ${categoryStripClass[category]}`} />
      <div className="p-5">
        <button
          type="button"
          onClick={onAuthorPress}
          disabled={!onAuthorPress}
          className="flex w-full items-center gap-3 text-left disabled:cursor-default"
        >
          {post.author.avatar_url ? (
            <img
              src={withAvatarSize(post.author.avatar_url, 48) ?? post.author.avatar_url}
              alt={post.author.display_name}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm text-text-2">
              {post.author.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{post.author.display_name}</p>
          </div>
          <p className="text-xs text-text-3">{timestamp}</p>
        </button>

        <button
          type="button"
          onClick={onComment}
          className="mt-4 w-full text-left text-base leading-relaxed text-text"
        >
          {post.body}
        </button>

        <div className="mt-3 flex items-center gap-2 text-xs text-text-2">
          <CategoryChip category={category} size="sm" />
          <button
            type="button"
            onClick={onOtherParticipantPress}
            disabled={!onOtherParticipantPress}
            className="disabled:cursor-default"
          >
            with {post.otherParticipantName ?? 'someone'}
          </button>
        </div>

        {hideActions ? null : (
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={onReact}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm text-text-2 transition-opacity active:opacity-80"
              aria-label="Toggle reaction"
            >
              <Heart
                size={20}
                strokeWidth={1.75}
                className={post.hasReacted ? 'text-accent' : 'text-text-2'}
                fill={post.hasReacted ? 'currentColor' : 'none'}
              />
              <span>{post.reactionCount}</span>
            </button>

            <button
              type="button"
              onClick={onComment}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm text-text-2 transition-opacity active:opacity-80"
              aria-label="Open comments"
            >
              <MessageCircle size={20} strokeWidth={1.75} />
              <span>{post.commentCount}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function toCategorySlug(value: string): CategorySlug {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
}

function toRelativeTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'just now'
  }
  return formatDistanceToNow(date, { addSuffix: true })
}
