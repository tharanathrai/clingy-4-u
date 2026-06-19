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
  onOpenDetail: () => void
  onComment: () => void
  onAuthorPress?: () => void
  onOtherParticipantPress?: () => void
  hideActions?: boolean
  showReactionInMetaWhenHidden?: boolean
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
  onOpenDetail,
  onComment,
  onAuthorPress,
  onOtherParticipantPress,
  hideActions = false,
  showReactionInMetaWhenHidden = false,
}: FeedPostCardProps) {
  const category = toCategorySlug(post.bridge.category)
  const timestamp = toRelativeTimestamp(post.created_at)

  return (
    <article className="overflow-hidden rounded-lg bg-surface shadow-card">
      <div className={`h-1 w-full ${categoryStripClass[category]}`} />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAuthorPress}
            disabled={!onAuthorPress}
            aria-label={`View ${post.author.display_name}'s profile`}
            className="shrink-0 disabled:cursor-default"
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
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onOpenDetail}
                className="max-w-full truncate text-left text-sm font-medium text-text"
              >
                {post.author.display_name}
              </button>
              <button
                type="button"
                onClick={onAuthorPress}
                disabled={!onAuthorPress}
                className="block truncate text-xs text-text-3 disabled:cursor-default"
              >
                @{post.author.username}
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenDetail}
              className="shrink-0 text-xs text-text-3"
            >
              {timestamp}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 w-full text-left text-base leading-relaxed text-text"
        >
          {post.body}
        </button>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-text-2">
          <div className="flex min-w-0 items-center gap-2">
            <CategoryChip category={category} size="sm" />
            <button
              type="button"
              onClick={onOtherParticipantPress}
              disabled={!onOtherParticipantPress}
              className="truncate disabled:cursor-default"
            >
              with {post.otherParticipantName ?? 'someone'}
            </button>
          </div>

          {!hideActions ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onComment}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-sm text-text-2 transition-opacity active:opacity-80"
                aria-label="Open comments"
              >
                <MessageCircle size={16} strokeWidth={1.75} />
                <span>{post.commentCount}</span>
              </button>
              <button
                type="button"
                onClick={onReact}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-sm text-text-2 transition-opacity active:opacity-80"
                aria-label="Toggle reaction"
              >
                <Heart
                  size={16}
                  strokeWidth={1.75}
                  className={post.hasReacted ? 'text-accent' : 'text-text-2'}
                  fill={post.hasReacted ? 'currentColor' : 'none'}
                />
                <span>{post.reactionCount}</span>
              </button>
            </div>
          ) : showReactionInMetaWhenHidden ? (
            <button
              type="button"
              onClick={onReact}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-sm text-text-2 transition-opacity active:opacity-80"
              aria-label="Toggle reaction"
            >
              <Heart
                size={16}
                strokeWidth={1.75}
                className={post.hasReacted ? 'text-accent' : 'text-text-2'}
                fill={post.hasReacted ? 'currentColor' : 'none'}
              />
              <span>{post.reactionCount}</span>
            </button>
          ) : null}
        </div>
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
