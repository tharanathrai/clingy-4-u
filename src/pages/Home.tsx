import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout.tsx'
import { GumPieceCard } from '../components/gum/GumPieceCard.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useGumPieces } from '../hooks/useGumPieces.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { supabase } from '../lib/supabase.ts'

const connectionsCountCache = new Map<string, number>()

export default function Home() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { pieces, loading, error, refetch } = useGumPieces()
  const navigate = useNavigate()
  const location = useLocation()
  const [connectionsCount, setConnectionsCount] = useState(0)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const pocketFull = pieces.length >= 25

  const loadConnectionsCount = useCallback(async () => {
    if (!userId) {
      setConnectionsCount(0)
      setLoadingConnections(false)
      return
    }

    const cachedCount = connectionsCountCache.get(userId)
    if (typeof cachedCount === 'number') {
      setConnectionsCount(cachedCount)
      setLoadingConnections(false)
    } else {
      setLoadingConnections(true)
    }
    const { count } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

    const nextCount = count ?? 0
    connectionsCountCache.set(userId, nextCount)
    setConnectionsCount(nextCount)
    setLoadingConnections(false)
  }, [userId])

  useEffect(() => {
    void loadConnectionsCount()
  }, [loadConnectionsCount])

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
        <header>
          <h1 className="app-page-title">your pocket</h1>
        </header>

        {loading || loadingConnections ? (
          <section className="mt-8 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-24 rounded-lg" />
            ))}
          </section>
        ) : null}

        {!loading && !loadingConnections && error ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Couldn&apos;t load your pocket. Pull to refresh.</p>
            <button
              type="button"
              onClick={() => {
                void refetch()
                void loadConnectionsCount()
              }}
              className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Retry
            </button>
          </section>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <EmptyStateIllustration />
            <h2 className="font-display text-2xl text-text">Your pocket is empty.</h2>
            <p className="mt-2 text-sm text-text-2">
              Make a plan with someone you love.
            </p>
            <Link
              to="/add"
              className="mt-5 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Add someone
            </Link>
          </section>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount > 0 && sortedPieces.length === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <EmptyStateIllustration />
            <h2 className="font-display text-2xl text-text">Nothing brewing yet.</h2>
            <p className="mt-2 text-sm text-text-2">
              Who do you want to do something with?
            </p>
            <Link
              to="/piece/new"
              className="mt-5 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              New gum
            </Link>
          </section>
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
            <button
              type="button"
              onClick={handleNewGum}
              disabled={pocketFull}
              className="new-gum-blob bg-accent px-6 py-3 font-display text-lg text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-55"
            >
              new gum
            </button>
          </div>
        </div>
      </main>
    </Layout>
  )
}
