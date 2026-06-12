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

const glowClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-intimate/20',
  active: 'bg-active/20',
  playful: 'bg-playful/20',
  explore: 'bg-explore/20',
  recharge: 'bg-recharge/20',
  savor: 'bg-savor/20',
  support: 'bg-support/20',
}

const morphDurationClasses = ['gum-morph-3', 'gum-morph-37', 'gum-morph-42'] as const

export function GumPieceCard({ piece, currentUserId, onPress }: GumPieceCardProps) {
  const category = toCategorySlug(piece.category)
  const accentClass = accentClassByCategory[category]
  const glowClass = glowClassByCategory[category]
  const morphClass = morphDurationClasses[idModulo(piece.id, 3)]
  const isPlaceholder = piece.status === 'placeholder'
  const partnerName =
    currentUserId === piece.recipient_id
      ? piece.creator_display_name ?? 'someone'
      : piece.recipient_display_name ?? 'someone'

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
        <div className="relative h-12 w-12 shrink-0">
          <span
            className={`pointer-events-none absolute inset-0 scale-[1.7] rounded-full blur-md ${glowClass}`}
            aria-hidden
          />
          <div
            className={`relative h-12 w-12 ${accentClass} gum-morph-base ${morphClass}`}
            aria-hidden
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
