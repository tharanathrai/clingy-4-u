import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { Bridge } from '../../types/index.ts'

interface UnwrapCeremonyProps {
  bridge: Bridge
  onComplete: () => void
}

export function UnwrapCeremony({ bridge, onComplete }: UnwrapCeremonyProps) {
  const [phase, setPhase] = useState<'start' | 'gum' | 'line' | 'text' | 'done'>(
    'start',
  )

  const categorySlug = toCategorySlug(bridge.category)
  const accentClass = useMemo(() => toAccentClass(categorySlug), [categorySlug])
  const reducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      const reducedTimer = window.setTimeout(() => {
        onComplete()
      }, 500)
      return () => {
        window.clearTimeout(reducedTimer)
      }
    }

    const gumTimer = window.setTimeout(() => setPhase('gum'), 400)
    const lineTimer = window.setTimeout(() => setPhase('line'), 700)
    const textTimer = window.setTimeout(() => setPhase('text'), 1300)
    const doneTimer = window.setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 2100)

    return () => {
      window.clearTimeout(gumTimer)
      window.clearTimeout(lineTimer)
      window.clearTimeout(textTimer)
      window.clearTimeout(doneTimer)
    }
  }, [onComplete, reducedMotion])

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 text-text">
      <div className="unwrap-scene">
        <div className="unwrap-wrapper" aria-hidden>
          <div
            className={`unwrap-half unwrap-half-top ${phase !== 'start' ? 'unwrap-half-top-open' : ''}`}
          />
          <div
            className={`unwrap-half unwrap-half-bottom ${phase !== 'start' ? 'unwrap-half-bottom-open' : ''}`}
          />
        </div>

        <div
          className={`unwrap-gum ${accentClass} ${phase === 'gum' || phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-gum-in' : ''}`}
        />

        <div className="unwrap-line-track">
          <div
            className={`unwrap-line ${accentClass} ${phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-line-grow' : ''}`}
          />
          <span
            className={`unwrap-line-end ${accentClass} ${phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-line-end-pulse' : ''}`}
          />
        </div>

        <div className={`unwrap-radial ${accentClass} ${phase === 'text' ? 'unwrap-radial-pulse' : ''}`} />
      </div>

      <h1 className={`mt-8 text-center font-display text-3xl ${phase === 'text' || phase === 'done' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        {bridge.activity_title}
      </h1>
      <p className={`mt-2 text-center text-sm text-text-2 ${phase === 'text' || phase === 'done' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        Bridge formed.
      </p>
    </section>
  )
}

function toCategorySlug(category: string): CategorySlug {
  if (category in CATEGORIES) {
    return category as CategorySlug
  }

  return 'explore'
}

function toAccentClass(category: CategorySlug): string {
  if (category === 'intimate') return 'bg-intimate'
  if (category === 'active') return 'bg-active'
  if (category === 'playful') return 'bg-playful'
  if (category === 'explore') return 'bg-explore'
  if (category === 'recharge') return 'bg-recharge'
  if (category === 'savor') return 'bg-savor'
  return 'bg-support'
}
