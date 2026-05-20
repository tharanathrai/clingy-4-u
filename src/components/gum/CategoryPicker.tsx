import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { CategoryChip } from './CategoryChip.tsx'

const categorySlugs = Object.keys(CATEGORIES) as CategorySlug[]

interface CategoryPickerProps {
  selectedCategory: CategorySlug | null
  onSelect: (category: CategorySlug) => void
}

export function CategoryPicker({ selectedCategory, onSelect }: CategoryPickerProps) {
  return (
    <ul className="flex flex-wrap gap-2" role="listbox" aria-label="Pick a vibe">
      {categorySlugs.map((slug) => {
        const isSelected = selectedCategory !== null && slug === selectedCategory
        return (
          <li key={slug} role="option" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => onSelect(slug)}
              className={`rounded-full transition active:scale-95 ${
                isSelected ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-bg' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <CategoryChip category={slug} size="sm" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
