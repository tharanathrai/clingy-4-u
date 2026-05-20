import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { CategoryChip } from './CategoryChip.tsx'

const categorySlugs = Object.keys(CATEGORIES) as CategorySlug[]

interface CategoryPickerProps {
  selectedCategory: CategorySlug
  onSelect: (category: CategorySlug) => void
}

export function CategoryPicker({ selectedCategory, onSelect }: CategoryPickerProps) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Choose a category">
      {categorySlugs.map((slug) => {
        const isSelected = slug === selectedCategory
        return (
          <li key={slug} role="option" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => onSelect(slug)}
              className={`rounded-full transition active:scale-95 ${
                isSelected ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-bg' : ''
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
