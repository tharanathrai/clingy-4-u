import { format } from 'date-fns'
import { useState } from 'react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { BridgeDetailSheet } from '../network/BridgeDetailSheet.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge, User } from '../../types/index.ts'

interface BridgeListItemProps {
  bridge: Bridge
  otherUser: User
}

const dotClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-intimate',
  active: 'bg-active',
  playful: 'bg-playful',
  explore: 'bg-explore',
  recharge: 'bg-recharge',
  savor: 'bg-savor',
  support: 'bg-support',
}

const toCategorySlug = (category: string): CategorySlug => {
  if (category in CATEGORIES) {
    return category as CategorySlug
  }
  return 'explore'
}

export function BridgeListItem({ bridge, otherUser }: BridgeListItemProps) {
  const [open, setOpen] = useState(false)
  const category = toCategorySlug(bridge.category)
  const dateLabel = format(new Date(bridge.formed_at), "'a' EEEE 'in' MMMM")

  return (
    <>
      <button
        type="button"
        className="w-full rounded-lg border border-white/10 bg-surface p-4 text-left transition active:scale-95"
        onClick={() => {
          setOpen(true)
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-6 w-6 rounded-full ${dotClassByCategory[category]}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-text">{bridge.activity_title}</p>
            <p className="mt-1 text-xs text-text-3">{dateLabel}</p>
          </div>
          <CategoryChip category={category} size="sm" />
        </div>
      </button>

      {open ? (
        <div className="app-fixed-viewport z-50 bg-black/55">
          <BridgeDetailSheet
            bridge={bridge}
            otherUser={otherUser}
            otherUserId={otherUser.id}
            onClose={() => {
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </>
  )
}
