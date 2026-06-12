import type { CSSProperties } from 'react'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { gumMorphClassFromId } from '../../lib/gumMorph.ts'
import type { GumPiece } from '../../hooks/useGumPieces.ts'
import { GumBlob } from '../ui/GumBlob.tsx'
import { LiquidSurface } from '../ui/LiquidSurface.tsx'
import { CategoryChip } from './CategoryChip.tsx'

interface GumPieceCardProps {
  piece: GumPiece
  currentUserId: string
  onPress: () => void
}

const accentClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-intimate',
  active: 'bg-active',
  playful: 'bg-playful',
  explore: 'bg-explore',
  recharge: 'bg-recharge',
  savor: 'bg-savor',
  support: 'bg-support',
}

export function GumPieceCard({ piece, currentUserId, onPress }: GumPieceCardProps) {
  const category = toCategorySlug(piece.category)
  const accentClass = accentClassByCategory[category]
  const morphClass = gumMorphClassFromId(piece.id)
  const isPlaceholder = piece.status === 'placeholder'
  const isExpired = piece.status === 'expired'
  const partnerName =
    currentUserId === piece.recipient_id
      ? piece.creator_display_name ?? 'someone'
      : piece.recipient_display_name ?? 'someone'

  const expiryDate = new Date(piece.expires_at)
  const leftText = `${formatDistanceToNow(expiryDate, { addSuffix: false })} left`
  const isWarning = differenceInDays(expiryDate, new Date()) < 7

  return (
    <LiquidSurface
      as="button"
      type="button"
      onClick={onPress}
      className={`w-full rounded-lg text-left shadow-liquid transition-opacity active:opacity-90 ${isPlaceholder ? 'opacity-60' : ''}`}
    >
      <span className={`block h-1 w-full ${accentClass}`} />
      <div className="flex items-center gap-4 p-6">
        <div className="relative h-12 w-12 shrink-0">
          <span
            className="liquid-glow pointer-events-none absolute inset-0 scale-[1.8] rounded-full blur-md"
            style={{ '--gum-color': CATEGORIES[category].color_hex } as CSSProperties}
            aria-hidden
          />
          <GumBlob
            category={category}
            size="md"
            morphClass={morphClass}
            variant={isExpired ? 'matte' : isPlaceholder ? 'floating' : 'settled'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-body font-normal text-text">{piece.title}</p>
          <div className="mt-2">
            <CategoryChip category={category} size="md" />
          </div>
          <p className="mt-2 text-xs text-text-3">with {partnerName}</p>
          <p className={`mt-2 text-xs ${isWarning ? 'text-savor' : 'text-text-2'}`}>
            {leftText} {isPlaceholder ? '(pending)' : ''}
          </p>
        </div>
      </div>
    </LiquidSurface>
  )
}

function toCategorySlug(value: string): CategorySlug {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }

  return 'explore'
}
