import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { GumPiece } from '../../hooks/useGumPieces.ts'
import { GumPieceCard } from './GumPieceCard.tsx'

interface CategoryShelfProps {
  category: CategorySlug
  pieces: GumPiece[]
  currentUserId: string
  onPressItem: (piece: GumPiece) => void
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

export function CategoryShelf({ category, pieces, currentUserId, onPressItem }: CategoryShelfProps) {
  const label = CATEGORIES[category].label
  const accentClass = accentClassByCategory[category]

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accentClass}`} />
        <p className="text-xs tracking-widest uppercase text-text-2">{label}</p>
      </div>
      <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 scroll-pl-5 pb-1">
        {pieces.map((piece) => (
          <div key={piece.id} className="w-[280px] flex-shrink-0 snap-start">
            <GumPieceCard
              piece={piece}
              currentUserId={currentUserId}
              onPress={() => onPressItem(piece)}
            />
          </div>
        ))}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  )
}
