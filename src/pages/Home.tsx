import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout.tsx'
import { CategoryShelf } from '../components/gum/CategoryShelf.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { ErrorState } from '../components/ErrorState.tsx'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useGumPieces } from '../hooks/useGumPieces.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import type { GumPiece } from '../hooks/useGumPieces.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import { supabase } from '../lib/supabase.ts'

async function fetchConnectionsCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
  return count ?? 0
}

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const { pieces, loading, error, refetch } = useGumPieces()
  const navigate = useNavigate()
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)
  const pocketFull = pieces.length >= 25

  const { data: connectionsCount = 0, isPending: connectionsPending } = useQuery({
    queryKey: queryKeys.connectionsCount(userId),
    queryFn: () => fetchConnectionsCount(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: Infinity,
  })
  const loadingConnections = isInitialQueryLoading(authLoading, userId, connectionsPending)

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (state?.toast) {
      setToast(state.toast)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const sortedPieces = useMemo(() => {
    return [...pieces].sort((a, b) => {
      if (a.status === 'placeholder' && b.status !== 'placeholder') {
        return -1
      }
      if (a.status !== 'placeholder' && b.status === 'placeholder') {
        return 1
      }

      return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
    })
  }, [pieces])

  const groupedByCategory = useMemo(() => {
    const groups: Partial<Record<CategorySlug, GumPiece[]>> = {}
    for (const piece of sortedPieces) {
      const cat = piece.category as CategorySlug
      if (!groups[cat]) groups[cat] = []
      groups[cat]!.push(piece)
    }
    return groups
  }, [sortedPieces])

  const handleNewGum = () => {
    if (pocketFull) {
      return
    }

    if (loadingConnections) {
      return
    }

    if (connectionsCount < 1) {
      setToast('Add someone first')
      return
    }

    void navigate('/piece/new')
  }

  if (loading || loadingConnections) {
    return <FullScreenSpinner />
  }

  return (
    <Layout>
      <main>
        <header className="flex items-end justify-between">
          <h1 className="app-page-title">your pocket</h1>
          <p className="text-xs text-text-3 pb-1">{pieces.length} / 25</p>
        </header>

        {error ? (
          <ErrorState message="Couldn't load your pocket." onRetry={() => void refetch()} />
        ) : null}

        {!error && connectionsCount === 0 ? (
          <EmptyState
            variant="gum"
            headline="Your pocket is empty."
            subline="Make a plan with someone you love — it sticks once you both show up."
            cta={{ label: 'Add someone', to: '/add' }}
          />
        ) : null}

        {!error && connectionsCount > 0 && sortedPieces.length === 0 ? (
          <EmptyState
            variant="gum"
            headline="Nothing sticky yet."
            subline="Who do you want to make a memory with?"
            cta={{ label: 'New plan', to: '/piece/new' }}
          />
        ) : null}

        {!error && sortedPieces.length > 0 ? (
          <div className="mt-6 space-y-6 pb-24">
            {(Object.keys(CATEGORIES) as CategorySlug[])
              .filter((cat) => groupedByCategory[cat]?.length)
              .map((cat) => (
                <CategoryShelf
                  key={cat}
                  category={cat}
                  pieces={groupedByCategory[cat]!}
                  currentUserId={user?.id ?? ''}
                  onPressItem={(piece) => void navigate(`/piece/${piece.id}`)}
                />
              ))}
          </div>
        ) : null}

        {toast ? (
          <div className="app-fixed-frame safe-bottom-28 z-40 px-5">
            <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
              {toast}
            </p>
          </div>
        ) : null}

        <div className="app-fixed-frame safe-bottom-24 z-30 px-5">
          <div className="app-fixed-frame-inner ml-auto flex flex-col items-end gap-2">
            {pocketFull ? (
              <p className="rounded-full bg-surface-2 px-3 py-1 text-xs text-text-2">
                Pocket full — complete or clear a plan first.
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleNewGum}
              disabled={pocketFull || loadingConnections}
              aria-label="new gum"
              className="new-gum-fab disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus size={26} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </main>
    </Layout>
  )
}
