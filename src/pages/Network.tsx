import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomTabBar } from '../components/layout/BottomTabBar.tsx'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { GraphExportButton } from '../components/network/GraphExportButton.tsx'
import { NetworkGraph } from '../components/network/NetworkGraph.tsx'
import { NodeProfileSheet } from '../components/network/NodeProfileSheet.tsx'
import { RecenterGraphButton } from '../components/network/RecenterGraphButton.tsx'
import { useBridges } from '../hooks/useBridges.ts'
import { useNetworkGraph } from '../hooks/useNetworkGraph.ts'
import type { Bridge } from '../types/index.ts'

export default function Network() {
  const navigate = useNavigate()
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const { nodes, edges, loading, error } = useNetworkGraph()
  const { bridges: selectedNodeBridges } = useBridges({
    otherUserId: selectedNodeId ?? undefined,
  })

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) ?? null
  }, [nodes, selectedNodeId])
  const selfNode = useMemo(() => {
    return nodes.find((node) => node.isSelf) ?? null
  }, [nodes])

  const selectedNodeSharedBridges = useMemo(() => {
    if (!selectedNodeId) {
      return []
    }
    return selectedNodeBridges.filter((bridge) => {
      return bridge.user_a_id === selectedNodeId || bridge.user_b_id === selectedNodeId
    })
  }, [selectedNodeBridges, selectedNodeId])

  const hasConnections = nodes.some((node) => !node.isSelf)
  const hasBridges = edges.length > 0

  const handleRecenter = () => {
    setSelectedNodeId(null)
    setSelectedBridge(null)
    setRecenterTrigger((value) => value + 1)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg text-text">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-6">
        <h1 className="pointer-events-auto font-display text-[18px] text-text">your network</h1>
        <div className="pointer-events-auto relative flex flex-col items-center gap-2">
          <RecenterGraphButton
            onRecenter={handleRecenter}
            disabled={loading || !!error || !hasConnections}
          />
          <GraphExportButton graphRef={graphCanvasRef} />
        </div>
      </header>

      <main className="h-screen w-screen">
        {hasConnections || loading || error ? (
          <NetworkGraph
            nodes={nodes}
            edges={edges}
            loading={loading}
            error={error}
            selectedNodeId={selectedNodeId}
            onNodeSelect={(userId) => {
              setSelectedNodeId(userId)
              setSelectedBridge(null)
            }}
            onBridgeSelect={setSelectedBridge}
            onBackgroundClick={() => {
              setSelectedNodeId(null)
              setSelectedBridge(null)
            }}
            graphCanvasRef={graphCanvasRef}
            recenterTrigger={recenterTrigger}
          />
        ) : null}

        {!loading && !hasConnections ? (
          <section className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
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

        {!loading && hasConnections && !hasBridges ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 mt-11 flex justify-center px-6 text-center">
            <p className="max-w-xs text-sm text-text-3">
              Make a plan. Show up. Bridges form here.
            </p>
          </div>
        ) : null}
      </main>

      <BridgeDetailSheet
        bridge={selectedBridge}
        currentUser={selfNode?.user ?? null}
        otherUser={selectedNode?.user ?? null}
        open={Boolean(selectedBridge)}
        onClose={() => {
          setSelectedBridge(null)
        }}
        onBackToNode={() => {
          setSelectedBridge(null)
        }}
      />

      <NodeProfileSheet
        node={selectedBridge ? null : selectedNode}
        bridges={selectedNodeSharedBridges}
        onClose={() => {
          setSelectedNodeId(null)
          setSelectedBridge(null)
        }}
        onViewProfile={(username) => {
          navigate(`/profile/${username}`)
        }}
      />

      <BottomTabBar />
    </div>
  )
}
