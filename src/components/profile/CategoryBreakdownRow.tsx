import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'

interface CategoryBreakdownRowProps {
  category: CategorySlug
  count: number
  total: number
}

const fillClassByCategory: Record<CategorySlug, string> = {
  intimate: 'bg-intimate',
  active: 'bg-active',
  playful: 'bg-playful',
  explore: 'bg-explore',
  recharge: 'bg-recharge',
  savor: 'bg-savor',
  support: 'bg-support',
}

const widthClassByShare = [
  { max: 0.1, className: 'w-1/12' },
  { max: 0.2, className: 'w-2/12' },
  { max: 0.3, className: 'w-1/3' },
  { max: 0.4, className: 'w-5/12' },
  { max: 0.5, className: 'w-1/2' },
  { max: 0.6, className: 'w-7/12' },
  { max: 0.7, className: 'w-8/12' },
  { max: 0.8, className: 'w-10/12' },
  { max: 0.9, className: 'w-11/12' },
  { max: 1, className: 'w-full' },
] as const

export function CategoryBreakdownRow({
  category,
  count,
  total,
}: CategoryBreakdownRowProps) {
  const share = total > 0 ? count / total : 0
  const widthClass =
    widthClassByShare.find((entry) => share <= entry.max)?.className ?? 'w-full'

  return (
    <article className="rounded-lg border border-white/10 bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${fillClassByCategory[category]}`}
            aria-hidden="true"
          />
          <p className="text-sm text-text">{CATEGORIES[category].label}</p>
        </div>
        <p className="text-sm text-text-2">
          {count} {count === 1 ? 'bridge' : 'bridges'}
        </p>
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-surface-2">
        <div
          className={`h-1 rounded-full ${fillClassByCategory[category]} ${widthClass}`}
        />
      </div>
    </article>
  )
}
