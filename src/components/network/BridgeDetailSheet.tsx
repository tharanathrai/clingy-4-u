import { format } from 'date-fns'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface BridgeDetailSheetProps {
  bridge: Bridge | null
  otherUser: User | null
  otherUserId: string | null
  onClose: () => void
}

const toCategorySlug = (value: string): CategorySlug => {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
}

export function BridgeDetailSheet({
  bridge,
  otherUser,
  onClose,
}: BridgeDetailSheetProps) {
  if (!bridge) {
    return null
  }

  const formattedDate = format(
    new Date(bridge.formed_at),
    "'a' EEEE 'in' MMMM",
  )
  const category = toCategorySlug(bridge.category)

  return (
    <section className="absolute inset-x-0 bottom-0 z-30 rounded-t-xl border-t border-white/10 bg-surface shadow-card">
      <div className="px-5 pb-tab-clearance pt-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
        aria-label="Close bridge details"
      >
        <X size={18} strokeWidth={1.75} />
      </button>

      <p className="font-display text-xl leading-tight text-text">
        {bridge.activity_title}
      </p>
      <div className="mt-3">
        <CategoryChip category={category} size="sm" />
      </div>
      <p className="mt-3 text-sm text-text-2">{formattedDate}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <article className="rounded-lg border border-white/10 bg-surface-2 p-3">
          <div className="mb-2 h-12 w-12 rounded-full bg-accent/30" />
          <p className="text-sm font-medium text-text">You</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-surface-2 p-3">
          {otherUser?.avatar_url ? (
            <img
              src={withAvatarSize(otherUser.avatar_url, 48) ?? otherUser.avatar_url}
              alt={otherUser.display_name}
              className="mb-2 h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/30 text-base font-medium text-text">
              {(otherUser?.display_name?.trim().charAt(0) ?? '?').toUpperCase()}
            </div>
          )}
          <p className="text-sm font-medium text-text">
            {otherUser?.display_name ?? 'Unknown'}
          </p>
        </article>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {otherUser?.id ? (
          <Link
            to="/piece/new"
            state={{
              recipientId: otherUser.id,
              returnTo: '/network',
              selectUserId: otherUser.id,
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
          >
            Make plan
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent/60 px-4 py-3 text-sm font-medium text-white/80">
            Make plan
          </span>
        )}
        {otherUser?.username ? (
          <Link
            to={`/profile/${otherUser.username}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface-2 px-4 py-3 text-sm font-medium text-text-2 transition active:scale-95"
          >
            View profile
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface-2 px-4 py-3 text-sm font-medium text-text-3">
            View profile
          </span>
        )}
      </div>
      </div>
    </section>
  )
}
