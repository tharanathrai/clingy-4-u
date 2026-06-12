import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout.tsx'
import { GumPieceCard } from '../components/gum/GumPieceCard.tsx'
import { LiquidButton } from '../components/ui/LiquidButton.tsx'
import { LiquidSurface } from '../components/ui/LiquidSurface.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useGumPieces } from '../hooks/useGumPieces.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
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
  const {
    visibleItems: visiblePieces,
    hasMore,
    loadMore,
  } = usePaginatedItems(sortedPieces, 6)

  const handleNewGum = () => {
    if (pocketFull) {
      return
    }

    if (connectionsCount < 1) {
      setToast('add someone first')
      return
    }

    void navigate('/piece/new')
  }

  return (
    <Layout>
      <main>
        <header className="flex items-end justify-between">
          <h1 className="app-page-title">your pocket</h1>
          {!loading && !loadingConnections ? (
            <p className="text-xs text-text-3 pb-1">{pieces.length} / 25</p>
          ) : null}
        </header>

        {loading || loadingConnections ? (
          <section className="mt-8 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-24 rounded-lg" />
            ))}
          </section>
        ) : null}

        {!loading && !loadingConnections && error ? (
          <LiquidSurface className="mt-8 rounded-lg p-6 text-center">
            <p className="text-sm text-text-2">Couldn&apos;t load your pocket. Pull to refresh.</p>
            <LiquidButton
              variant="secondary"
              onClick={() => {
                void refetch()
              }}
              className="mt-4 px-5 py-2"
            >
              Retry
            </LiquidButton>
          </LiquidSurface>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount === 0 ? (
          <LiquidSurface className="mt-8 rounded-lg p-6 text-center">
            <EmptyStateIllustration />
            <h2 className="font-display text-2xl text-text">Your pocket is empty.</h2>
            <p className="mt-2 text-sm text-text-2">
              Make a plan with someone you love.
            </p>
            <Link
              to="/add"
              className="btn-liquid-primary mt-5 inline-flex px-7 py-3.5 no-underline"
            >
              <span className="btn-liquid-sheen" aria-hidden />
              Add someone
            </Link>
          </LiquidSurface>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount > 0 && sortedPieces.length === 0 ? (
          <LiquidSurface className="mt-8 rounded-lg p-6 text-center">
            <EmptyStateIllustration />
            <h2 className="font-display text-2xl text-text">Your pocket is empty.</h2>
            <p className="mt-2 text-sm text-text-2">Make a plan with someone you love.</p>
            <Link
              to="/piece/new"
              className="btn-liquid-primary mt-5 inline-flex px-7 py-3.5 no-underline"
            >
              <span className="btn-liquid-sheen" aria-hidden />
              New plan
            </Link>
          </LiquidSurface>
        ) : null}

        {!loading && !loadingConnections && !error && sortedPieces.length > 0 ? (
          <ul className="mt-6 space-y-3 pb-24">
            {visiblePieces.map((piece) => (
              <li key={piece.id}>
                <GumPieceCard
                  piece={piece}
                  currentUserId={user?.id ?? ''}
                  onPress={() => void navigate(`/piece/${piece.id}`)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !loadingConnections && !error && hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              className="rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Load more
            </button>
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
            <LiquidButton
              variant="blob"
              onClick={handleNewGum}
              disabled={pocketFull}
              className="new-gum-blob disabled:cursor-not-allowed disabled:opacity-55"
            >
              new gum
            </LiquidButton>
          </div>
        </div>
      </main>
    </Layout>
  )
}
