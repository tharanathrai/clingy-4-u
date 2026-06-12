import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'

interface GumballProps {
  categoryBreakdown: Record<CategorySlug, number>
  size?: number
}

interface TooltipState {
  category: CategorySlug
  count: number
}

type PatchConfig = {
  slug: CategorySlug
  path: string
}

const PATCHES: PatchConfig[] = [
  {
    slug: 'intimate',
    path: 'M8 23 C18 10, 36 8, 47 16 C54 22, 53 36, 40 42 C27 48, 14 42, 8 23 Z',
  },
  {
    slug: 'active',
    path: 'M42 12 C58 8, 75 16, 80 29 C82 39, 74 50, 62 52 C49 55, 39 47, 37 33 C35 24, 36 15, 42 12 Z',
  },
  {
    slug: 'playful',
    path: 'M61 38 C74 32, 90 38, 93 53 C95 65, 86 76, 72 79 C60 82, 51 74, 48 62 C46 52, 50 43, 61 38 Z',
  },
  {
    slug: 'explore',
    path: 'M18 46 C30 40, 46 45, 50 58 C54 71, 44 83, 30 85 C17 87, 7 78, 6 64 C5 56, 9 50, 18 46 Z',
  },
  {
    slug: 'recharge',
    path: 'M35 55 C45 49, 60 53, 65 65 C70 76, 63 88, 50 92 C39 95, 27 89, 24 77 C21 68, 25 60, 35 55 Z',
  },
  {
    slug: 'savor',
    path: 'M20 27 C27 21, 37 20, 45 26 C51 31, 53 39, 49 45 C42 53, 27 52, 19 44 C14 39, 14 31, 20 27 Z',
  },
  {
    slug: 'support',
    path: 'M52 58 C64 52, 80 56, 86 69 C92 81, 84 93, 70 95 C57 98, 45 91, 42 79 C40 70, 43 62, 52 58 Z',
  },
]

const TRACE_PATCHES = [
  'M20 38 C30 30, 46 34, 51 46 C54 55, 47 63, 36 65 C24 66, 16 58, 15 48 C14 44, 16 41, 20 38 Z',
  'M52 30 C62 24, 76 28, 80 39 C84 49, 78 60, 67 63 C56 66, 46 60, 43 50 C41 42, 44 34, 52 30 Z',
] as const

const SCALE_CLASS_BY_SHARE = [
  { max: 0.12, className: 'gumball-patch-scale-55' },
  { max: 0.2, className: 'gumball-patch-scale-7' },
  { max: 0.3, className: 'gumball-patch-scale-85' },
  { max: 0.45, className: 'gumball-patch-scale-1' },
  { max: 1, className: 'gumball-patch-scale-115' },
] as const

function GumballPatch({
  path,
  slug,
  scaleClass,
  onPress,
  onRelease,
}: {
  path: string
  slug: CategorySlug
  scaleClass: string
  onPress: () => void
  onRelease: () => void
}) {
  const gradientId = `gumball-patch-${slug}`

  return (
    <g className={`gumball-patch ${scaleClass}`}>
      <path
        d={path}
        fill={`url(#${gradientId})`}
        onPointerDown={onPress}
        onPointerUp={onRelease}
      />
      <path
        d={path}
        className="gumball-patch-highlight"
        fill="url(#gumball-patch-specular)"
        fillOpacity={0.42}
      />
    </g>
  )
}

export function Gumball({ categoryBreakdown, size = 160 }: GumballProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const total = useMemo(
    () => Object.values(categoryBreakdown).reduce((sum, value) => sum + value, 0),
    [categoryBreakdown],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const visiblePatches = useMemo(() => {
    if (total === 0) {
      return []
    }

    return PATCHES.filter((patch) => categoryBreakdown[patch.slug] > 0).map((patch) => {
      const count = categoryBreakdown[patch.slug]
      const share = count / total
      const scaleClass = SCALE_CLASS_BY_SHARE.find(
        (entry) => share <= entry.max,
      )?.className

      return {
        ...patch,
        count,
        scaleClass: scaleClass ?? 'gumball-patch-scale-1',
      }
    })
  }, [categoryBreakdown, total])

  const primaryPatch = useMemo(() => {
    if (visiblePatches.length !== 1) {
      return null
    }
    return visiblePatches[0]
  }, [visiblePatches])

  const showTooltip = (category: CategorySlug, count: number) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    setTooltip({ category, count })
    timeoutRef.current = window.setTimeout(() => {
      setTooltip(null)
    }, 2000)
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Category gumball"
        className="drop-shadow-[0_0_36px_rgba(207,142,232,0.2)]"
        width={size}
        height={size}
      >
        <defs>
          <clipPath id="gumball-blob-clip">
            <path
              className="gumball-blob-clip"
              d="M50 5 C72 2, 93 16, 95 38 C98 58, 88 82, 67 92 C48 100, 24 95, 12 77 C2 62, 4 39, 14 23 C23 10, 34 7, 50 5 Z"
            />
          </clipPath>
          <radialGradient id="gumball-empty-liquid" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3a3548" />
            <stop offset="45%" stopColor="#272438" />
            <stop offset="100%" stopColor="#1a1728" />
          </radialGradient>
          <radialGradient id="gumball-patch-specular" cx="28%" cy="22%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {PATCHES.map((patch) => (
            <radialGradient
              key={patch.slug}
              id={`gumball-patch-${patch.slug}`}
              cx="32%"
              cy="28%"
              r="75%"
            >
              <stop
                offset="0%"
                stopColor={CATEGORIES[patch.slug].color_hex}
                stopOpacity="1"
              />
              <stop
                offset="55%"
                stopColor={CATEGORIES[patch.slug].color_hex}
                stopOpacity="0.95"
              />
              <stop
                offset="100%"
                stopColor={CATEGORIES[patch.slug].color_hex}
                stopOpacity="0.72"
              />
            </radialGradient>
          ))}
        </defs>

        <g clipPath="url(#gumball-blob-clip)">
          {total === 0 ? (
            <rect x="0" y="0" width="100" height="100" className="gumball-empty-fill" />
          ) : null}

          {primaryPatch ? (
            <>
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill={`url(#gumball-patch-${primaryPatch.slug})`}
              />
              {TRACE_PATCHES.map((path, index) => (
                <path
                  key={`trace-${path}`}
                  d={path}
                  fill={
                    PATCHES.filter((patch) => patch.slug !== primaryPatch.slug)[index]
                      ? CATEGORIES[
                          PATCHES.filter((patch) => patch.slug !== primaryPatch.slug)[index]
                            .slug
                        ].color_hex
                      : CATEGORIES.explore.color_hex
                  }
                  fillOpacity="0.22"
                />
              ))}
              <GumballPatch
                path={primaryPatch.path}
                slug={primaryPatch.slug}
                scaleClass={primaryPatch.scaleClass}
                onPress={() => {
                  showTooltip(primaryPatch.slug, primaryPatch.count)
                }}
                onRelease={() => {
                  setTooltip(null)
                }}
              />
            </>
          ) : null}

          {!primaryPatch
            ? visiblePatches.map((patch) => (
                <GumballPatch
                  key={patch.slug}
                  path={patch.path}
                  slug={patch.slug}
                  scaleClass={patch.scaleClass}
                  onPress={() => {
                    showTooltip(patch.slug, patch.count)
                  }}
                  onRelease={() => {
                    setTooltip(null)
                  }}
                />
              ))
            : null}
        </g>
        <ellipse
          cx="34"
          cy="26"
          rx="22"
          ry="14"
          fill="url(#gumball-patch-specular)"
          fillOpacity="0.28"
          clipPath="url(#gumball-blob-clip)"
          pointerEvents="none"
        />
      </svg>

      {tooltip ? (
        <div className="liquid-surface pointer-events-none absolute -bottom-7 rounded-full px-3 py-1 text-xs text-text">
          {CATEGORIES[tooltip.category].label} · {tooltip.count}{' '}
          {tooltip.count === 1 ? 'bridge' : 'bridges'}
        </div>
      ) : null}
    </div>
  )
}
