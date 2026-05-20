import { format } from 'date-fns'
import { formatDistanceToNow } from 'date-fns'
import { ChevronUp, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'
import { withAvatarSize } from '../../utils/avatar.ts'
import { useBridgesByPair } from '../../hooks/useBridgesByPair.ts'

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
  otherUserId,
  onClose,
}: BridgeDetailSheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const { bridges } = useBridgesByPair({
    otherUserId: otherUserId ?? '',
  })

  if (!bridge) {
    return null
  }

  const formattedDate = format(
    new Date(bridge.formed_at),
    "'a' EEEE 'in' MMMM",
  )
  const category = toCategorySlug(bridge.category)
  const recentSharedBridges = [...bridges]
    .filter((item) => item.id !== bridge.id)
    .sort((a, b) => new Date(b.formed_at).getTime() - new Date(a.formed_at).getTime())
    .slice(0, 2)

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-30 h-auto rounded-t-xl border-t border-white/10 bg-surface shadow-card transition-[max-height] duration-200 ${
        expanded ? 'max-h-[68vh]' : 'max-h-[42vh]'
      }`}
    >
      <button
        type="button"
        aria-label="Expand bridge details"
        className="flex min-h-11 w-full justify-center py-3"
        onClick={() => {
          setExpanded((previous) => !previous)
        }}
        onTouchStart={(event) => {
          setTouchStartY(event.touches[0]?.clientY ?? null)
        }}
        onTouchEnd={(event) => {
          const startY = touchStartY
          const endY = event.changedTouches[0]?.clientY
          if (startY === null || typeof endY !== 'number') {
            return
          }
          const deltaY = endY - startY
          if (deltaY < -30) {
            setExpanded(true)
          } else if (deltaY > 30) {
            setExpanded(false)
          }
          setTouchStartY(null)
        }}
      >
        <span className="h-1 w-9 rounded-full bg-white/20" />
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-text-3">
          {expanded ? 'Less' : 'More'}
          <ChevronUp
            size={14}
            strokeWidth={1.75}
            className={expanded ? 'text-text-3' : 'rotate-180 text-text-3'}
          />
        </span>
      </button>
      <div className="h-full overflow-y-auto px-5 pb-8">
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

      {expanded ? (
        <section className="mt-5 rounded-lg border border-white/10 bg-surface-2 p-4">
          <p className="text-xs uppercase tracking-wide text-text-3">Connection context</p>
          <p className="mt-2 text-sm text-text-2">
            {bridges.length} shared bridge{bridges.length === 1 ? '' : 's'} total
          </p>
          {recentSharedBridges.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {recentSharedBridges.map((item) => (
                <li key={item.id} className="rounded-md bg-bg/40 px-3 py-2">
                  <p className="text-sm text-text">{item.activity_title}</p>
                  <p className="mt-1 text-xs text-text-3">
                    {formatDistanceToNow(new Date(item.formed_at), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-3">No additional shared activity yet.</p>
          )}
        </section>
      ) : null}

      {otherUser?.id ? (
        <Link
          to="/piece/new"
          state={{ recipientId: otherUser.id }}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
        >
          Make another plan
        </Link>
      ) : null}
      </div>
    </section>
  )
}
