import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { GraphShareButton } from '../components/network/GraphShareButton.tsx'
import { NetworkHeaderMenu } from '../components/network/NetworkHeaderMenu.tsx'
import { NetworkGraph } from '../components/network/NetworkGraph.tsx'
import { NodeProfileSheet } from '../components/network/NodeProfileSheet.tsx'
import { RecenterGraphButton } from '../components/network/RecenterGraphButton.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useNetworkGraph } from '../hooks/useNetworkGraph.ts'
import { usePendingRequestCount } from '../hooks/usePendingRequestCount.ts'
import type { Bridge, User } from '../types/index.ts'

const networkUserCache = new Map<string, User>()

export default function Network() {
  const navigate = useNavigate()
  const location = useLocation()
  const { usersById } = useNetworkGraph()
  const pendingRequestCount = usePendingRequestCount()
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [graphState, setGraphState] = useState({
    hasConnections: false,
    canvasReady: false,
    loading: true,
    error: null as string | null,
  })


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

  const prepareGraphSnapshot = useCallback(async (): Promise<() => void> => {
    const previousUserId = selectedUserId
    const previousBridge = selectedBridge
    const previousUser = selectedUser

    if (!previousUserId && !previousBridge) {
      return () => {}
    }

    setSelectedBridge(null)
    setSelectedUserId(null)
    setSelectedUser(null)

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve())
      })
    })
    await new Promise((resolve) => {
      window.setTimeout(resolve, 120)
    })

    return () => {
      if (previousUserId) {
        setSelectedUserId(previousUserId)
        if (previousUser) {
          setSelectedUser(previousUser)
        }
      }
      if (previousBridge) {
        setSelectedBridge(previousBridge)
      }
    }
  }, [selectedBridge, selectedUser, selectedUserId])

  const graphActionsDisabled =
    graphState.loading || !!graphState.error || !graphState.hasConnections

  return (
    <div className="safe-screen-height relative mx-auto w-full max-w-md overflow-hidden bg-bg text-text">
      <header className="safe-content-top absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5">
        <h1 className="app-page-title">your network</h1>
        <div className="relative flex flex-col items-center gap-2">
          <NetworkHeaderMenu pendingRequestCount={pendingRequestCount} />
          <RecenterGraphButton onRecenter={handleRecenter} disabled={graphActionsDisabled} />
          <GraphShareButton
            graphRef={graphCanvasRef}
            disabled={graphActionsDisabled || !graphState.canvasReady}
            prepareForSnapshot={prepareGraphSnapshot}
          />
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
