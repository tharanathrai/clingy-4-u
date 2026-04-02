import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout.tsx'
import { GumPieceCard } from '../components/gum/GumPieceCard.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useGumPieces } from '../hooks/useGumPieces.ts'
import { supabase } from '../lib/supabase.ts'

export default function Home() {
  const { user } = useAuth()
  const { pieces, loading, error, refetch } = useGumPieces()
  const navigate = useNavigate()
  const location = useLocation()
  const [connectionsCount, setConnectionsCount] = useState(0)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const loadConnectionsCount = useCallback(async () => {
    if (!user) {
      setConnectionsCount(0)
      setLoadingConnections(false)
      return
    }

    setLoadingConnections(true)
    const { count } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

    setConnectionsCount(count ?? 0)
    setLoadingConnections(false)
  }, [user])

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

  const handleNewGum = () => {
    if (connectionsCount < 1) {
      setToast('add someone first')
      return
    }

    void navigate('/piece/new')
  }

  return (
    <Layout>
      <main className="pb-28">
        <header>
          <h1 className="font-display text-4xl text-text">your pocket</h1>
          <p className="mt-2 text-xs text-text-3">{pieces.length} / 25 slots used</p>
        </header>

        <div className="mt-4">
          <button
            type="button"
            className="rounded-full bg-surface-2 px-4 py-2 text-xs font-medium text-text-2"
            onClick={() => {
              void refetch()
              void loadConnectionsCount()
            }}
          >
            Refresh
          </button>
        </div>

        {loading || loadingConnections ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Loading your pocket...</p>
          </section>
        ) : null}

        {!loading && !loadingConnections && error ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-playful">{error}</p>
          </section>
        ) : null}

        {!loading && !loadingConnections && !error && connectionsCount === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
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
          <ul className="mt-6 space-y-3">
            {sortedPieces.map((piece) => (
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

        {toast ? (
          <p className="fixed inset-x-5 bottom-28 z-40 rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleNewGum}
          className="new-gum-blob fixed bottom-24 right-5 z-30 bg-accent px-6 py-3 font-display text-lg text-white shadow-glow"
        >
          new gum
        </button>
      </main>
    </Layout>
  )
}
