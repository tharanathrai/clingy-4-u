import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { CategoryChip } from '../gum/CategoryChip.tsx'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { supabase } from '../../lib/supabase.ts'
import type { User } from '../../types/index.ts'
import { useBridgesByPair } from '../../hooks/useBridgesByPair.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface NodeProfileSheetProps {
  userId: string | null
  onClose: () => void
  onViewProfile: (username: string) => void
  onCreatePlan: (recipientId: string) => void
}

const toCategorySlug = (value: string): CategorySlug => {
  if (value in CATEGORIES) {
    return value as CategorySlug
  }
  return 'explore'
}

export function NodeProfileSheet({
  userId,
  onClose,
  onViewProfile,
  onCreatePlan,
}: NodeProfileSheetProps) {
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const { bridges, loading: loadingBridges } = useBridgesByPair({
    otherUserId: userId ?? '',
  })

  useEffect(() => {
    if (!userId) {
      setOtherUser(null)
      setLoadingUser(false)
      return
    }

    let cancelled = false

    const loadUser = async () => {
      setLoadingUser(true)
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!cancelled) {
        setOtherUser((data ?? null) as User | null)
        setLoadingUser(false)
      }
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [userId])

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

  if (!userId) {
    return null
  }

  return (
    <section className="absolute inset-x-0 bottom-0 z-20 rounded-t-xl border-t border-white/10 bg-surface shadow-card">
      <div className="px-5 pb-8 pt-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
        aria-label="Close profile preview"
      >
        <X size={18} strokeWidth={1.75} />
      </button>

      {loadingUser || loadingBridges ? (
        <p className="py-8 text-center text-sm text-text-2">
          Loading connection details...
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {otherUser?.avatar_url ? (
              <img
                src={withAvatarSize(otherUser.avatar_url, 64) ?? otherUser.avatar_url}
                alt={otherUser.display_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-xl font-medium text-text">
                {(otherUser?.display_name?.trim().charAt(0) ?? '?').toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-2xl text-text">
                {otherUser?.display_name ?? 'Unknown'}
              </p>
              <p className="text-sm text-text-2">
                @{otherUser?.username ?? 'unknown'}
              </p>
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
              <span className="text-xs text-text-3">No bridges yet</span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (otherUser?.id) {
                  onCreatePlan(otherUser.id)
                }
              }}
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              disabled={!otherUser?.id}
            >
              Make plan
            </button>

            <button
              type="button"
              onClick={() => {
                if (otherUser?.username) {
                  onViewProfile(otherUser.username)
                }
              }}
              className="w-full rounded-full bg-surface-2 px-4 py-3 text-sm font-medium text-text-2 transition active:scale-95 disabled:opacity-50"
              disabled={!otherUser?.username}
            >
              View profile
            </button>
          </div>
        </>
      )}
      </div>
    </section>
  )
}
