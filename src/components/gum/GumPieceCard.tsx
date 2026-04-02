import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { GumPiece } from '../../hooks/useGumPieces.ts'
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

const morphDurationClasses = ['gum-morph-3', 'gum-morph-37', 'gum-morph-42'] as const

export function GumPieceCard({ piece, currentUserId, onPress }: GumPieceCardProps) {
  const category = toCategorySlug(piece.category)
  const accentClass = accentClassByCategory[category]
  const morphClass = morphDurationClasses[idModulo(piece.id, 3)]
  const isPlaceholder = piece.status === 'placeholder'
  const isRecipient = currentUserId === piece.recipient_id
  const partnerLabel = isRecipient ? 'from them' : 'to them'

  const expiryDate = new Date(piece.expires_at)
  const leftText = `${formatDistanceToNow(expiryDate, { addSuffix: false })} left`
  const isWarning = differenceInDays(expiryDate, new Date()) < 7

  return (
    <button
      type="button"
      onClick={onPress}
      className={`w-full overflow-hidden rounded-lg bg-surface text-left shadow-card transition-opacity active:opacity-90 ${isPlaceholder ? 'gum-placeholder-float opacity-60' : ''}`}
    >
      <span className={`block h-1 w-full ${accentClass}`} />
      <div className="flex items-center gap-4 p-6">
        <div
          className={`h-12 w-12 shrink-0 ${accentClass} gum-morph-base ${morphClass}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-body font-normal text-text">{piece.title}</p>
          <div className="mt-2">
            <CategoryChip category={category} size="md" />
          </div>
          <p className={`mt-2 text-xs ${isWarning ? 'text-savor' : 'text-text-2'}`}>
            {leftText} {isPlaceholder ? `(${partnerLabel})` : ''}
          </p>
        </div>
      </div>
    </button>
  )
}

function toCategorySlug(value: string): CategorySlug {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }

  return 'explore'
}

function idModulo(id: string, divisor: number): number {
  let total = 0
  for (let index = 0; index < id.length; index += 1) {
    total += id.charCodeAt(index)
  }

  return total % divisor
}
