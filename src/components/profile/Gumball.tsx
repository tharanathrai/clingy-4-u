import { useMemo } from 'react'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'

interface GumballProps {
  categoryBreakdown: Record<CategorySlug, number>
  size?: number
}

const PATCH_POSITIONS: Record<CategorySlug, { x: number; y: number }> = {
  intimate:  { x: 32, y: 30 },
  active:    { x: 66, y: 28 },
  playful:   { x: 72, y: 62 },
  explore:   { x: 58, y: 76 },
  recharge:  { x: 38, y: 72 },
  savor:     { x: 26, y: 54 },
  support:   { x: 50, y: 42 },
}

export function Gumball({ categoryBreakdown, size = 160 }: GumballProps) {
  const total = useMemo(
    () => Object.values(categoryBreakdown).reduce((sum, v) => sum + v, 0),
    [categoryBreakdown],
  )

  const patches = useMemo(() => {
    if (total === 0) return []
    return (Object.keys(PATCH_POSITIONS) as CategorySlug[])
      .filter((slug) => categoryBreakdown[slug] > 0)
      .map((slug) => {
        const share = categoryBreakdown[slug] / total
        const patchSize = Math.round(size * (0.38 + share * 0.28))
        return { slug, ...PATCH_POSITIONS[slug], patchSize }
      })
  }, [categoryBreakdown, total, size])

  const blurPx = Math.round(size * 0.065)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="gum-morph-base gum-morph-37 absolute inset-0 overflow-hidden bg-surface-2 shadow-gloss-gum"
        style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
      >
        {patches.map((patch) => (
          <span
            key={patch.slug}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${patch.x}%`,
              top: `${patch.y}%`,
              width: patch.patchSize,
              height: patch.patchSize,
              transform: 'translate(-50%, -50%)',
              background: CATEGORIES[patch.slug].color_hex,
              filter: `blur(${blurPx}px)`,
              opacity: 0.95,
            }}
          />
        ))}
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            top: '16%',
            left: '20%',
            width: '38%',
            height: '30%',
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), transparent 70%)',
          }}
        />
      </div>
    </div>
  )
}
