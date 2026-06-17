import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { GumPiece } from '../../hooks/useGumPieces.ts'
import { CategoryChip } from './CategoryChip.tsx'
import { GumBlob } from './GumBlob.tsx'

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
  const morphSeed = idModulo(piece.id, 3)
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
      className={`w-full overflow-hidden rounded-lg bg-surface text-left shadow-card transition-transform active:scale-[0.98] ${isPlaceholder ? 'gum-placeholder-float opacity-60' : ''}`}
    >
      <span className={`block h-1 w-full ${accentClass}`} />
      <div className="flex items-center gap-4 p-6">
        <GumBlob category={category} size={48} float={isPlaceholder} morphSeed={morphSeed} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-body font-normal text-text">{piece.title}</p>
          <div className="mt-2">
            <CategoryChip category={category} size="md" />
          </div>
          <p className="mt-2 text-xs text-text-2">with {partnerName}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className={`text-xs ${isWarning ? 'text-savor' : 'text-text-2'}`}>{leftText}</p>
            {isPlaceholder ? (
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-text-3">
                awaiting
              </span>
            ) : null}
          </div>
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
