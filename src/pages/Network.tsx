import { useEffect, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { GraphExportButton } from '../components/network/GraphExportButton.tsx'
import { NetworkGraph } from '../components/network/NetworkGraph.tsx'
import { NodeProfileSheet } from '../components/network/NodeProfileSheet.tsx'
import { RecenterGraphButton } from '../components/network/RecenterGraphButton.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useNetworkGraph } from '../hooks/useNetworkGraph.ts'
import { supabase } from '../lib/supabase.ts'
import type { Bridge, User } from '../types/index.ts'

const networkUserCache = new Map<string, User>()

async function fetchPendingRequestCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .neq('requested_by', userId)
  return count ?? 0
}

export default function Network() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const { usersById } = useNetworkGraph()
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [graphState, setGraphState] = useState({
    hasConnections: false,
    hasBridges: false,
    loading: true,
    error: null as string | null,
  })

  const { data: pendingRequestCount = 0 } = useQuery({
    queryKey: ['pending-request-count', userId],
    queryFn: () => fetchPendingRequestCount(userId!),
    enabled: userId !== null,
    staleTime: 60 * 1000,
  })

  // Real-time update for pending count
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`network-pending-requests-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['pending-request-count', userId] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  useEffect(() => {
    const state = location.state as { selectUserId?: string } | null
    if (!state?.selectUserId) {
      return
    }

    setSelectedBridge(null)
    setSelectedUserId(state.selectUserId)
    const restoredUser =
      networkUserCache.get(state.selectUserId) ?? usersById[state.selectUserId] ?? null
    if (restoredUser) {
      setSelectedUser(restoredUser)
    }
    window.history.replaceState({}, document.title)
  }, [location.state, usersById])

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    const cachedUser =
      networkUserCache.get(selectedUserId) ?? usersById[selectedUserId] ?? null
    if (cachedUser) {
      setSelectedUser(cachedUser)
      return
    }

    if (selectedUser?.id === selectedUserId) {
      return
    }
  }, [selectedUser?.id, selectedUserId, usersById])

  const handleRecenter = () => {
    setSelectedUserId(null)
    setSelectedBridge(null)
    setRecenterTrigger((value) => value + 1)
  }

  return (
    <div className="safe-screen-height relative mx-auto w-full max-w-md overflow-hidden bg-bg text-text">
      <header className="safe-content-top absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5">
        <h1 className="app-page-title">your network</h1>
        <div className="relative flex items-center gap-2">
          <Link
            to="/connections/requests"
            className="relative rounded-full border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-text-2 transition hover:border-white/25 hover:bg-surface-2 active:scale-95"
            aria-label="Open connection requests"
            title="Connection requests"
          >
            Requests
            {pendingRequestCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-playful px-1.5 py-0.5 text-[10px] leading-none text-white">
                {pendingRequestCount}
              </span>
            ) : null}
          </Link>
          <Link
            to="/add"
            className="rounded-full border border-white/10 bg-surface px-3 py-2 text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95"
            aria-label="Add someone"
            title="Add someone"
          >
            <UserPlus size={18} strokeWidth={1.75} />
          </Link>
          <RecenterGraphButton
            onRecenter={handleRecenter}
            disabled={graphState.loading || !!graphState.error}
          />
          <GraphExportButton graphRef={graphCanvasRef} />
        </div>
      </header>

      <main className="h-full w-full">
        {!graphState.loading && graphState.error ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg px-8 text-center">
            <p className="text-sm text-playful">Couldn&apos;t load your network.</p>
            <button
              type="button"
              onClick={() => setGraphState((s) => ({ ...s, error: null, loading: true }))}
              className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Retry
            </button>
          </div>
        ) : null}
        <NetworkGraph
          onNodeSelect={(userId, user) => {
            if (!userId) {
              return
            }
            setSelectedUserId(userId)
            if (user) {
              networkUserCache.set(userId, user)
              setSelectedUser(user)
            } else {
              setSelectedUser(usersById[userId] ?? networkUserCache.get(userId) ?? null)
            }
            setSelectedBridge(null)
          }}
          selectedUserId={selectedUserId}
          onBridgeSelect={(bridge) => {
            setSelectedBridge(bridge)
          }}
          onGraphStateChange={setGraphState}
          graphCanvasRef={graphCanvasRef}
          recenterTrigger={recenterTrigger}
        />

        {!graphState.loading && !graphState.hasConnections ? (
          <section className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
            <div className="pointer-events-auto">
              <EmptyStateIllustration variant="bridge" />
              <h2 className="font-display text-3xl text-text">No bridges yet.</h2>
              <p className="mt-3 text-sm text-text-2">
                They form when you actually show up.
              </p>
              <Link
                to="/add"
                className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
              >
                Add someone
              </Link>
            </div>
          </section>
        ) : null}

        {!graphState.loading &&
        graphState.hasConnections &&
        !graphState.hasBridges ? (
          <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-6 text-center">
            <p className="rounded-full bg-surface/80 px-4 py-2 text-xs text-text-2 backdrop-blur">
              Make a plan. Show up. Bridges form here.
            </p>
          </div>
        ) : null}
      </main>

      {selectedBridge ? (
        <BridgeDetailSheet
          bridge={selectedBridge}
          otherUser={selectedUser}
          otherUserId={selectedUserId}
          onClose={() => {
            setSelectedBridge(null)
          }}
        />
      ) : selectedUserId ? (
        <NodeProfileSheet
          userId={selectedUserId}
          preloadedUser={selectedUser}
          onClose={() => {
            setSelectedUserId(null)
          }}
          onViewProfile={(username) => {
            navigate(`/profile/${username}`)
          }}
          onCreatePlan={(recipientId) => {
            navigate('/piece/new', {
              state: {
                recipientId,
                returnTo: '/network',
                selectUserId: recipientId,
              },
            })
          }}
        />
      ) : null}
    </div>
  )
}
