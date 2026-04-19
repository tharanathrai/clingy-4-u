import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import type { NetworkGraphNode } from '../../hooks/useNetworkGraph.ts'
import type { Bridge } from '../../types/index.ts'

interface NodeProfileSheetProps {
  node: NetworkGraphNode | null
  bridges: Bridge[]
  onClose: () => void
  onViewProfile: (username: string) => void
}

const toCategorySlug = (value: string): CategorySlug => {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
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

export function NodeProfileSheet({
  node,
  bridges,
  onClose,
  onViewProfile,
}: NodeProfileSheetProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [displayedNode, setDisplayedNode] = useState<NetworkGraphNode | null>(null)
  const [contentFading, setContentFading] = useState(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [touchCurrentY, setTouchCurrentY] = useState<number | null>(null)

  useEffect(() => {
    if (node) {
      setIsMounted(true)
      window.requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return
    }

    setIsVisible(false)
    const timeout = window.setTimeout(() => {
      setIsMounted(false)
      setDisplayedNode(null)
    }, 200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [node])

  useEffect(() => {
    if (!node) {
      return
    }

    if (!displayedNode) {
      setDisplayedNode(node)
      return
    }

    if (displayedNode.id === node.id) {
      setDisplayedNode(node)
      return
    }

    setContentFading(true)
    const timeout = window.setTimeout(() => {
      setDisplayedNode(node)
      setContentFading(false)
    }, 150)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [displayedNode, node])

  const topCategories = useMemo(() => {
    const counts: Record<CategorySlug, number> = {
      intimate: 0,
      active: 0,
      playful: 0,
      explore: 0,
      recharge: 0,
      savor: 0,
      support: 0,
    }

    for (const bridge of bridges) {
      const category = toCategorySlug(bridge.category)
      counts[category] += 1
    }

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category as CategorySlug)
  }, [bridges])

  const recentBridges = useMemo(() => {
    return [...bridges]
      .sort((left, right) => {
        return new Date(right.formed_at).getTime() - new Date(left.formed_at).getTime()
      })
      .slice(0, 3)
  }, [bridges])

  if (!isMounted || !displayedNode) {
    return null
  }

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-30 h-[42vh] rounded-t-xl border-t border-white/10 bg-surface shadow-card transition-transform will-change-transform ${
        isVisible
          ? 'translate-y-0 duration-[280ms] [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]'
          : 'translate-y-full duration-200 ease-in'
      }`}
      onTouchStart={(event) => {
        setTouchStartY(event.touches[0]?.clientY ?? null)
        setTouchCurrentY(event.touches[0]?.clientY ?? null)
      }}
      onTouchMove={(event) => {
        setTouchCurrentY(event.touches[0]?.clientY ?? null)
      }}
      onTouchEnd={() => {
        if (touchStartY !== null && touchCurrentY !== null && touchCurrentY - touchStartY > 60) {
          onClose()
        }
        setTouchStartY(null)
        setTouchCurrentY(null)
      }}
    >
      <button
        type="button"
        aria-label="Dismiss profile"
        className="flex w-full justify-center py-3"
        onClick={onClose}
      >
        <span className="h-1 w-9 rounded-full bg-white/20" />
      </button>

      <div
        className={`h-[calc(42vh-28px)] overflow-y-auto px-5 pb-8 transition-opacity duration-150 ${
          contentFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <>
          <div className="flex items-center gap-3">
            {displayedNode.user.avatar_url ? (
              <img
                src={displayedNode.user.avatar_url}
                alt={displayedNode.user.display_name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-lg font-medium text-text">
                {(displayedNode.user.display_name.trim().charAt(0) ?? '?').toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-[20px] leading-tight text-text">
                {displayedNode.user.display_name}
              </p>
              <p className="text-sm text-text-2">@{displayedNode.user.username}</p>
            </div>
          </div>

          <p className="mt-5 text-sm text-text-2">
            {bridges.length} bridges together
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {topCategories.length ? (
              topCategories.map((category) => (
                <CategoryChip key={category} category={category} size="sm" />
              ))
            ) : (
              <span className="text-xs text-text-3">No shared categories yet</span>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {recentBridges.length ? (
              recentBridges.map((bridge) => (
                <div
                  key={bridge.id}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-surface-2 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotClassByCategory[toCategorySlug(bridge.category)]}`} />
                    <p className="text-sm text-text">{bridge.activity_title}</p>
                  </div>
                  <p className="text-xs text-text-3">
                    {format(new Date(bridge.formed_at), 'MMM d, yyyy')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-3">No bridges to show yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onViewProfile(displayedNode.user.username)
            }}
            className="mt-6 w-full rounded-full border border-white/20 bg-surface-2 px-5 py-3 text-sm font-medium text-text transition hover:border-white/30 active:scale-95"
          >
            View full profile →
          </button>
        </>
      </div>
    </section>
  )
}
