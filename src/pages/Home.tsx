import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout.tsx'
import { CategoryShelf } from '../components/gum/CategoryShelf.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
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
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Couldn&apos;t load your pocket.</p>
            <button
              type="button"
              onClick={() => {
                void refetch()
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
              className="btn-primary mt-5 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Add someone
            </Link>
          </section>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount > 0 && sortedPieces.length === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <EmptyStateIllustration />
            <h2 className="font-display text-2xl text-text">Nothing brewing yet.</h2>
            <p className="mt-2 text-sm text-text-2">Who do you want to do something with?</p>
            <Link
              to="/piece/new"
              className="btn-primary mt-5 inline-block rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              New plan
            </Link>
          </section>
        ) : null}

        {!loading && !loadingConnections && !error && sortedPieces.length > 0 ? (
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
              className="btn-primary new-gum-blob bg-accent px-6 py-3 font-display text-lg text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-55"
            >
              new gum
            </button>
          </div>
        </div>
      </main>
    </Layout>
  )
}
