import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomTabBar } from '../components/layout/BottomTabBar.tsx'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { GraphExportButton } from '../components/network/GraphExportButton.tsx'
import { NetworkGraph } from '../components/network/NetworkGraph.tsx'
import { NodeProfileSheet } from '../components/network/NodeProfileSheet.tsx'
import { RecenterGraphButton } from '../components/network/RecenterGraphButton.tsx'
import { supabase } from '../lib/supabase.ts'
import type { Bridge, User } from '../types/index.ts'

export default function Network() {
  const navigate = useNavigate()
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

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    let cancelled = false

    const loadSelectedUser = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', selectedUserId)
        .maybeSingle()

      if (!cancelled) {
        setSelectedUser((data ?? null) as User | null)
      }
    }

    void loadSelectedUser()

    return () => {
      cancelled = true
    }
  }, [selectedUserId])

  const handleRecenter = () => {
    setSelectedUserId(null)
    setSelectedBridge(null)
    setRecenterTrigger((value) => value + 1)
  }

  return (
    <div className="relative mx-auto h-screen w-full max-w-md overflow-hidden bg-bg text-text">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6">
        <h1 className="font-display text-2xl text-text">your network</h1>
        <div className="relative flex items-center gap-2">
          <RecenterGraphButton
            onRecenter={handleRecenter}
            disabled={graphState.loading || !!graphState.error}
          />
          <GraphExportButton graphRef={graphCanvasRef} />
        </div>
      </header>

      <main className="h-full w-full">
        <NetworkGraph
          onNodeSelect={(userId) => {
            setSelectedUserId(userId)
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
          onClose={() => {
            setSelectedBridge(null)
          }}
        />
      ) : selectedUserId ? (
        <NodeProfileSheet
          userId={selectedUserId}
          onClose={() => {
            setSelectedUserId(null)
          }}
          onViewProfile={(username) => {
            navigate(`/profile/${username}`)
          }}
        />
      ) : null}

      <BottomTabBar />
    </div>
  )
}
