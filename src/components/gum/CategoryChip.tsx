import type { CategorySlug } from '../../lib/constants.ts'
import { CATEGORIES } from '../../lib/constants.ts'

interface CategoryChipProps {
  category: CategorySlug
  size?: 'sm' | 'md'
}

const chipClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-tint-intimate text-intimate',
  active: 'bg-tint-active text-active',
  playful: 'bg-tint-playful text-playful',
  explore: 'bg-tint-explore text-explore',
  recharge: 'bg-tint-recharge text-recharge',
  savor: 'bg-tint-savor text-savor',
  support: 'bg-tint-support text-support',
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
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-1.5 text-[11px]',
} as const

export function CategoryChip({ category, size = 'md' }: CategoryChipProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full font-body font-medium uppercase tracking-label ${chipClassByCategory[category]} ${sizeClassMap[size]}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotClassByCategory[category]}`} />
      {CATEGORIES[category].label}
    </span>
  )
}
