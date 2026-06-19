import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { GraphShareButton } from '../components/network/GraphShareButton.tsx'
import { NetworkHeaderMenu } from '../components/network/NetworkHeaderMenu.tsx'
import { NetworkGraph } from '../components/network/NetworkGraph.tsx'
import { NodeProfileSheet } from '../components/network/NodeProfileSheet.tsx'
import { RecenterGraphButton } from '../components/network/RecenterGraphButton.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { ErrorState } from '../components/ErrorState.tsx'
import { getNetworkShareStats } from '../lib/networkShareStats.ts'
import { useNetworkGraph } from '../hooks/useNetworkGraph.ts'
import { usePendingRequestCount } from '../hooks/usePendingRequestCount.ts'
import type { Bridge, User } from '../types/index.ts'

const networkUserCache = new Map<string, User>()

export default function Network() {
  const navigate = useNavigate()
  const location = useLocation()
  const { nodes, edges, usersById, refetch: refetchGraph } = useNetworkGraph()
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

  const shareCardOptions = useMemo(() => getNetworkShareStats(nodes, edges), [edges, nodes])

  useEffect(() => {
    const state = location.state as { selectUserId?: string } | null
    if (!state?.selectUserId) return

    setSelectedBridge(null)
    setSelectedUserId(state.selectUserId)
    const restoredUser =
      networkUserCache.get(state.selectUserId) ?? usersById[state.selectUserId] ?? null
    if (restoredUser) setSelectedUser(restoredUser)
    window.history.replaceState({}, document.title)
  }, [location.state, usersById])

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    const cachedUser = networkUserCache.get(selectedUserId) ?? usersById[selectedUserId] ?? null
    if (cachedUser) {
      setSelectedUser(cachedUser)
      return
    }

    if (selectedUser?.id === selectedUserId) return
  }, [selectedUser?.id, selectedUserId, usersById])

  const handleRecenter = () => {
    setSelectedUserId(null)
    setSelectedBridge(null)
    setRecenterTrigger((value) => value + 1)
  }

  const graphActionsDisabled = graphState.loading || !!graphState.error || !graphState.hasConnections

  return (
    <div className="safe-screen-height relative mx-auto w-full max-w-md overflow-hidden bg-bg text-text">
      <header className="safe-content-top absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5">
        <h1 className="app-page-title">your bridges</h1>
        <div className="flex items-center gap-2 pt-1">
          <RecenterGraphButton onRecenter={handleRecenter} disabled={graphActionsDisabled} />
          <GraphShareButton
            disabled={graphActionsDisabled}
            shareCardOptions={shareCardOptions}
          />
          <NetworkHeaderMenu pendingRequestCount={pendingRequestCount} />
        </div>
      </header>

      <main className="h-full w-full">
        {!graphState.loading && graphState.error ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg px-8">
            <ErrorState
              framed={false}
              message="Couldn't load your network."
              onRetry={() => {
                setGraphState((s) => ({ ...s, error: null }))
                refetchGraph()
              }}
            />
          </div>
        ) : null}
        <NetworkGraph
          exportMode={false}
          onRegisterExportRecenter={() => {}}
          onNodeSelect={(userId, user) => {
            if (!userId) return
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
              <EmptyState
                framed={false}
                variant="bridge"
                headline="No bridges yet."
                subline="They stretch into shape when you actually show up."
                cta={{ label: 'Add someone', to: '/add' }}
              />
            </div>
          </section>
        ) : null}
      </main>

      {selectedBridge ? (
        <BridgeDetailSheet
          bridge={selectedBridge}
          otherUser={selectedUser}
          otherUserId={selectedUserId}
          variant="network"
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
            navigate(`/profile/${username}`, {
              state: {
                returnTo: '/network',
                ...(selectedUserId ? { selectUserId: selectedUserId } : {}),
              },
            })
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
