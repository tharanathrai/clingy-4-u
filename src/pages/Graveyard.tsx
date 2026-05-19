import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 py-8 text-text">
      <Link to="/profile/me" className="inline-flex items-center gap-2 text-sm text-text-2">
        <ArrowLeft size={18} strokeWidth={1.75} />
        back
      </Link>
      <h1 className="app-page-title mt-6">graveyard</h1>
      <p className="mt-3 text-sm text-text-2">Plans that didn&apos;t happen.</p>

      {loading ? <p className="mt-8 text-sm text-text-2">Loading...</p> : null}
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
          const partnerName = namesById[partnerId] ?? 'Someone'
          const createdAgo = formatDistanceToNow(new Date(entry.created_at), {
            addSuffix: true,
          })
          const expiredAgo = formatDistanceToNow(new Date(entry.expired_at), {
            addSuffix: true,
          })

          return (
            <article
              key={entry.id}
              className="graveyard-muted rounded-lg bg-surface px-4 py-4 shadow-card"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 shrink-0 rounded-full ${getCategoryClass(entry.category)}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-base text-text">{entry.title}</p>
                  <p className="text-sm text-text-2">with {partnerName}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-3">created {createdAgo}</p>
              <p className="mt-1 text-xs text-text-3">expired {expiredAgo}</p>
            </article>
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

function getCategoryClass(category: string): string {
  if (category === 'intimate') return 'bg-intimate'
  if (category === 'active') return 'bg-active'
  if (category === 'playful') return 'bg-playful'
  if (category === 'explore') return 'bg-explore'
  if (category === 'recharge') return 'bg-recharge'
  if (category === 'savor') return 'bg-savor'
  return 'bg-support'
}
