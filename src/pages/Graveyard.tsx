import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { GumBlob } from '../components/ui/GumBlob.tsx'
import { LiquidSurface } from '../components/ui/LiquidSurface.tsx'
import { type CategorySlug, CATEGORIES } from '../lib/constants.ts'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellScroll } from '../components/layout/pageShell.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { supabase } from '../lib/supabase.ts'

interface GraveyardEntry {
  id: string
  gum_piece_id: string
  user_a_id: string
  user_b_id: string
  title: string
  category: string
  color_hex: string
  created_at: string
  expired_at: string
}

interface UserNameRow {
  id: string
  display_name: string
}

export default function Graveyard() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [entries, setEntries] = useState<GraveyardEntry[]>([])
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadEntries = async () => {
      if (!userId) {
        setEntries([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('graveyard')
        .select('*')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('expired_at', { ascending: false })

      if (queryError) {
        setError(queryError.message)
        setEntries([])
        setLoading(false)
        return
      }

      const loadedEntries = (data ?? []) as GraveyardEntry[]
      setEntries(loadedEntries)

      const participantIds = Array.from(
        new Set(
          loadedEntries.flatMap((entry) => [entry.user_a_id, entry.user_b_id]),
        ),
      )
      if (participantIds.length > 0) {
        const { data: usersRows } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', participantIds)

        const nextNames = (usersRows ?? []).reduce<Record<string, string>>(
          (acc, row) => {
            const userRow = row as UserNameRow
            acc[userRow.id] = userRow.display_name
            return acc
          },
          {},
        )
        setNamesById(nextNames)
      }

      setLoading(false)
    }

    if (authLoading) {
      return
    }

    void loadEntries()
  }, [authLoading, userId])

  const empty = useMemo(() => !loading && entries.length === 0, [entries.length, loading])
  const { visibleItems: visibleEntries, hasMore, loadMore } = usePaginatedItems(
    entries,
    6,
  )

  return (
    <main className={pageShellScroll}>
      <BackHeader to="/profile/me" />
      <h1 className="app-page-title mt-4">graveyard</h1>
      <p className="mt-3 text-sm text-text-2">Plans that didn&apos;t happen.</p>

      {loading ? (
        <section className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-24 rounded-lg" />
          ))}
        </section>
      ) : null}
      {error ? <p className="mt-8 text-sm text-playful">{error}</p> : null}

      {empty ? (
        <section className="mt-10 rounded-lg bg-surface p-6 text-center">
          <EmptyStateIllustration />
          <p className="font-display text-2xl text-text">Nothing here.</p>
          <p className="mt-2 text-sm text-text-2">Keep it that way.</p>
        </section>
      ) : null}

      <section className="mt-8 space-y-3 pb-10">
        {visibleEntries.map((entry) => {
          const partnerId = userId === entry.user_a_id ? entry.user_b_id : entry.user_a_id
          const partnerName = namesById[partnerId] ?? 'Unknown user'
          const createdAgo = formatDistanceToNow(new Date(entry.created_at), {
            addSuffix: true,
          })
          const expiredAgo = formatDistanceToNow(new Date(entry.expired_at), {
            addSuffix: true,
          })

          return (
            <LiquidSurface
              as="article"
              key={entry.id}
              className="graveyard-muted rounded-lg px-4 py-4 shadow-liquid"
            >
              <div className="flex items-center gap-3">
                <GumBlob
                  category={toCategorySlug(entry.category)}
                  size="md"
                  variant="matte"
                  className="h-11 w-11 shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-base text-text">{entry.title}</p>
                  <p className="text-sm text-text-2">with {partnerName}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-3">created {createdAgo}</p>
              <p className="mt-1 text-xs text-text-3">expired {expiredAgo}</p>
            </LiquidSurface>
          )
        })}
      </section>

      {!loading && !error && hasMore ? (
        <div className="pb-10">
          <button
            type="button"
            onClick={loadMore}
            className="w-full rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
          >
            Load more
          </button>
        </div>
      ) : null}
    </main>
  )
}

function toCategorySlug(category: string): CategorySlug {
  if (category in CATEGORIES) {
    return category as CategorySlug
  }
  return 'explore'
}

