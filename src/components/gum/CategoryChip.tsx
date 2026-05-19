import type { CategorySlug } from '../../lib/constants.ts'
import { CATEGORIES } from '../../lib/constants.ts'

interface CategoryChipProps {
  category: CategorySlug
  size?: 'sm' | 'md'
}

const chipClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-intimate/20 text-intimate',
  active: 'bg-active/20 text-active',
  playful: 'bg-playful/20 text-playful',
  explore: 'bg-explore/20 text-explore',
  recharge: 'bg-recharge/20 text-recharge',
  savor: 'bg-savor/20 text-savor',
  support: 'bg-support/20 text-support',
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

const sizeClassMap = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-xs',
} as const

export function CategoryChip({ category, size = 'md' }: CategoryChipProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full font-body font-medium uppercase tracking-wide ${chipClassByCategory[category]} ${sizeClassMap[size]}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotClassByCategory[category]}`} />
      {CATEGORIES[category].label}
    </span>
  )
}
