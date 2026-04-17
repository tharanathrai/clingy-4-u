import { format } from 'date-fns'
import { X } from 'lucide-react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'

interface BridgeDetailSheetProps {
  bridge: Bridge | null
  otherUser: User | null
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
    <section className="absolute inset-x-0 bottom-0 z-30 rounded-t-xl border-t border-white/10 bg-surface p-5 pb-8 shadow-card">
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-3 rounded-full p-2 text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
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
              src={otherUser.avatar_url}
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
    </section>
  )
}
