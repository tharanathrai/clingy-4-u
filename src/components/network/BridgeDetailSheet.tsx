import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'

interface BridgeDetailSheetProps {
  bridge: Bridge | null
  currentUser?: User | null
  otherUser: User | null
  open?: boolean
  onClose: () => void
  onBackToNode?: () => void
}

const toCategorySlug = (value: string): CategorySlug => {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
}

export function BridgeDetailSheet({
  bridge,
  currentUser,
  otherUser,
  open = Boolean(bridge),
  onClose,
  onBackToNode,
}: BridgeDetailSheetProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [touchCurrentY, setTouchCurrentY] = useState<number | null>(null)

  useEffect(() => {
    if (open && bridge) {
      setIsMounted(true)
      window.requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return
    }

    setIsVisible(false)
    const timeout = window.setTimeout(() => {
      setIsMounted(false)
    }, 200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [bridge, open])

  if (!bridge || !isMounted) {
    return null
  }

  const formattedDate = format(
    new Date(bridge.formed_at),
    "'a' EEEE 'in' MMMM",
  )
  const category = toCategorySlug(bridge.category)

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-40 h-[42vh] rounded-t-xl border-t border-white/10 bg-surface shadow-card transition-transform will-change-transform ${
        isVisible
          ? 'translate-y-0 duration-[280ms] [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]'
          : 'translate-y-full duration-200 ease-in'
      }`}
      onTouchStart={(event) => {
        setTouchStartY(event.touches[0]?.clientY ?? null)
        setTouchCurrentY(event.touches[0]?.clientY ?? null)
      }}
      onTouchMove={(event) => {
        setTouchCurrentY(event.touches[0]?.clientY ?? null)
      }}
      onTouchEnd={() => {
        if (touchStartY !== null && touchCurrentY !== null && touchCurrentY - touchStartY > 60) {
          onClose()
        }
        setTouchStartY(null)
        setTouchCurrentY(null)
      }}
    >
      <button
        type="button"
        aria-label="Dismiss bridge details"
        className="flex w-full justify-center py-3"
        onClick={onClose}
      >
        <span className="h-1 w-9 rounded-full bg-white/20" />
      </button>

      <div className="h-[calc(42vh-28px)] overflow-y-auto px-5 pb-8">
        <p className="font-display text-[22px] leading-tight text-text">{bridge.activity_title}</p>

        <div className="mt-3">
          <CategoryChip category={category} size="sm" />
        </div>
        <p className="mt-3 text-sm text-text-2">{formattedDate}</p>

        <div className="mt-5 flex items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.display_name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-text">
                {(currentUser?.display_name?.trim().charAt(0) ?? 'Y').toUpperCase()}
              </div>
            )}
            <p className="text-center text-xs text-text">You</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.display_name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-text">
                {(otherUser?.display_name?.trim().charAt(0) ?? '?').toUpperCase()}
              </div>
            )}
            <p className="text-center text-xs text-text">
              {otherUser?.display_name ?? 'Unknown'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToNode ?? onClose}
          className="mt-6 text-sm text-text-2 transition hover:text-text"
        >
          ← All bridges with {otherUser?.display_name ?? 'this person'}
        </button>
      </div>
    </section>
  )
}
