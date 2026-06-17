import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'

interface GumBlobProps {
  category: CategorySlug
  size?: number
  float?: boolean
  morphSeed?: number
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

export function GumBlob({ category, size = 48, float = false, morphSeed = 1 }: GumBlobProps) {
  const accentClass = accentClassByCategory[category]
  const morphClass = morphDurationClasses[Math.abs(morphSeed) % 3]
  const colorHex = CATEGORIES[category].color_hex

  return (
    <span
      className="relative inline-grid place-items-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '-40%',
          background: `radial-gradient(circle at center, ${colorHex}4D 0%, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        className={`relative w-full h-full overflow-hidden shadow-gloss-gum gum-morph-base ${morphClass} ${accentClass} ${float ? 'gum-placeholder-float' : ''}`}
      >
        <span
          aria-hidden
          className="absolute pointer-events-none rounded-full"
          style={{
            top: '12%',
            left: '14%',
            width: '42%',
            height: '34%',
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), transparent 70%)',
          }}
        />
      </span>
    </span>
  )
}
