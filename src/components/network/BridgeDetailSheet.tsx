import { format } from 'date-fns'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfile } from '../../hooks/useProfile.ts'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'
import { networkProfileReturnState } from '../../lib/navigationContext.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

export type BridgeDetailVariant = 'network' | 'profile'

interface BridgeDetailSheetProps {
  bridge: Bridge | null
  otherUser: User | null
  otherUserId: string | null
  onClose: () => void
  variant?: BridgeDetailVariant
}

function ParticipantAvatar({
  user,
  label,
}: {
  user: Pick<User, 'avatar_url' | 'display_name'> | null
  label: string
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-surface-2 p-3">
      {user?.avatar_url ? (
        <img
          src={withAvatarSize(user.avatar_url, 48) ?? user.avatar_url}
          alt={user.display_name}
          className="mb-2 h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/30 text-base font-medium text-text">
          {(user?.display_name?.trim().charAt(0) ?? '?').toUpperCase()}
        </div>
      )}
      <p className="text-sm font-medium text-text">{label}</p>
    </article>
  )
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
  variant = 'network',
}: BridgeDetailSheetProps) {
  const { user } = useAuth()
  const { profile: viewerProfile } = useProfile({ userId: user?.id })

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
        <ParticipantAvatar user={viewerProfile} label="You" />
        <ParticipantAvatar
          user={otherUser}
          label={otherUser?.display_name ?? 'Unknown'}
        />
      </div>

      {variant === 'network' ? (
      <div className="mt-6 grid grid-cols-2 gap-3">
        {otherUser?.id ? (
          <Link
            to="/piece/new"
            state={{
              recipientId: otherUser.id,
              returnTo: '/network',
              selectUserId: otherUser.id,
            }}
            className="btn-primary inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white"
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
            state={networkProfileReturnState(otherUser.id)}
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
      ) : null}
      </div>
    </section>
  )
}
