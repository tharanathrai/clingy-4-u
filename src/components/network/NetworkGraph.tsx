import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import ForceGraph2D, {
  type ForceGraphMethods,
} from 'react-force-graph-2d'
import type { Bridge } from '../../types/index.ts'
import {
  useNetworkGraph,
  type NetworkGraphEdge,
  type NetworkGraphNode,
} from '../../hooks/useNetworkGraph.ts'

type GraphNode = NetworkGraphNode & {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

type GraphEdge = Omit<NetworkGraphEdge, 'source' | 'target'> & {
  source: string | GraphNode
  target: string | GraphNode
}

interface NetworkGraphProps {
  onNodeSelect: (userId: string | null) => void
  selectedUserId: string | null
  onBridgeSelect?: (bridge: Bridge | null) => void
  onGraphStateChange?: (state: {
    hasConnections: boolean
    hasBridges: boolean
    loading: boolean
    error: string | null
  }) => void
  graphCanvasRef?: MutableRefObject<HTMLCanvasElement | null>
  recenterTrigger?: number
}

interface GraphCameraState {
  x: number
  y: number
  k: number
}

const graphCameraCacheByUserId = new Map<string, GraphCameraState>()

const MIN_GRAPH_ZOOM = 0.45
const MAX_GRAPH_ZOOM = 4

const isFiniteCameraState = (camera: GraphCameraState): boolean => {
  return Number.isFinite(camera.x) && Number.isFinite(camera.y) && Number.isFinite(camera.k)
}

const normalizePair = (left: string, right: string): string => {
  return [left, right].sort().join(':')
}

const getCategoryColor = (bridges: Bridge[]): string => {
  if (!bridges.length) {
    return '#F2EFF8'
  }

  const counts: Record<string, number> = {}
  for (const bridge of bridges) {
    counts[bridge.color_hex] = (counts[bridge.color_hex] ?? 0) + 1
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

const getLinkWidth = (count: number): number => {
  if (count >= 5) {
    return 4
  }
  if (count >= 3) {
    return 2.5
  }
  return 1.5
}

export function NetworkGraph({
  onNodeSelect,
  selectedUserId,
  onBridgeSelect,
  onGraphStateChange,
  graphCanvasRef,
  recenterTrigger = 0,
}: NetworkGraphProps) {
  const { nodes, edges, loading, error } = useNetworkGraph()
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | undefined>(
    undefined,
  )
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const avatarCacheRef = useRef<Record<string, HTMLImageElement>>({})
  const hasAppliedInitialCameraRef = useRef<null | string>(null)
  const programmaticCameraUntilRef = useRef(0)
  const zoomEventCountRef = useRef(0)
  const [graphSize, setGraphSize] = useState({
    width: 0,
    height: 0,
  })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)

  useEffect(() => {
    for (const node of nodes) {
      const url = node.user.avatar_url
      if (!url || avatarCacheRef.current[url]) {
        continue
      }

      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = url
      avatarCacheRef.current[url] = image
    }
  }, [nodes])

  useEffect(() => {
    const updateSize = () => {
      const container = graphContainerRef.current
      if (!container) {
        return
      }

      const bounds = container.getBoundingClientRect()
      const width = Math.round(bounds.width)
      const height = Math.round(bounds.height)
      // #region agent log
      fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-pre-fix',hypothesisId:'H3',location:'NetworkGraph.tsx:updateSize',message:'Measured graph container size',data:{width,height,windowWidth:window.innerWidth,windowHeight:window.innerHeight},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setGraphSize({
        width: Math.max(0, width),
        height: Math.max(0, height),
      })
    }

    window.requestAnimationFrame(updateSize)
    const container = graphContainerRef.current
    const resizeObserver = container
      ? new ResizeObserver(() => {
          updateSize()
        })
      : null
    if (container && resizeObserver) {
      resizeObserver.observe(container)
    }
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  const selfUserId = useMemo(() => {
    return nodes.find((node) => node.isSelf)?.id ?? null
  }, [nodes])

  const maxOrbitRadius = useMemo(() => {
    const orbitNodes = nodes.filter((node) => !node.isSelf).length
    if (orbitNodes === 0) {
      return 120
    }

    let ringIndex = 0
    let usedSlots = 0
    let slotsInRing = 6

    while (usedSlots + slotsInRing < orbitNodes) {
      usedSlots += slotsInRing
      ringIndex += 1
      slotsInRing = 6 + ringIndex * 4
    }

    return 140 + ringIndex * 115
  }, [nodes])

  const recenterGraph = (duration = 250) => {
    const bounds = graphContainerRef.current?.getBoundingClientRect()
    const containerWidth = Math.round(bounds?.width ?? graphSize.width)
    const containerHeight = Math.round(bounds?.height ?? graphSize.height)
    const padding = containerWidth < 640 ? 26 : 72
    const usableWidth = Math.max(1, containerWidth - padding * 2)
    const usableHeight = Math.max(1, containerHeight - padding * 2)
    const diameter = Math.max(120, maxOrbitRadius * 2 + 80)
    const zoom = Math.max(
      MIN_GRAPH_ZOOM,
      Math.min(1.25, Math.min(usableWidth / diameter, usableHeight / diameter)),
    )
    programmaticCameraUntilRef.current = Date.now() + duration + 120
    // #region agent log
    fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'post-fix',hypothesisId:'H3',location:'NetworkGraph.tsx:recenterGraph',message:'Recenter computed camera from measured container',data:{duration,containerWidth,containerHeight,padding,usableWidth,usableHeight,diameter,zoom,maxOrbitRadius,selfUserId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    graphRef.current?.centerAt(0, 0, duration)
    graphRef.current?.zoom(zoom, duration)
    if (selfUserId) {
      graphCameraCacheByUserId.set(selfUserId, { x: 0, y: 0, k: zoom })
    }
  }

  useEffect(() => {
    if (!graphRef.current || loading || error || nodes.length === 0) {
      return
    }

    const cacheKey = selfUserId ?? 'anonymous'
    const fitCamera = (force = false) => {
      if (hasAppliedInitialCameraRef.current === cacheKey && !force) {
        return
      }

      const cachedCamera = selfUserId
        ? graphCameraCacheByUserId.get(selfUserId)
        : null
      const hasValidCamera =
        !!cachedCamera &&
        isFiniteCameraState(cachedCamera) &&
        cachedCamera.k >= MIN_GRAPH_ZOOM &&
        cachedCamera.k <= MAX_GRAPH_ZOOM

      // #region agent log
      fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'post-fix',hypothesisId:'H1',location:'NetworkGraph.tsx:fitCamera',message:'Evaluated cached camera for restore',data:{cacheKey,force,selfUserId,cachedCamera:cachedCamera??null,hasValidCamera,hasAppliedInitialCamera:hasAppliedInitialCameraRef.current,loading,error,nodesCount:nodes.length,graphWidth:graphSize.width,graphHeight:graphSize.height},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (hasValidCamera && cachedCamera) {
        programmaticCameraUntilRef.current = Date.now() + 200
        graphRef.current?.centerAt(cachedCamera.x, cachedCamera.y, 0)
        graphRef.current?.zoom(cachedCamera.k, 0)
        // #region agent log
        fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'post-fix',hypothesisId:'H1',location:'NetworkGraph.tsx:fitCamera',message:'Applied cached camera',data:{cameraX:cachedCamera.x,cameraY:cachedCamera.y,cameraK:cachedCamera.k},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'post-fix',hypothesisId:'H4',location:'NetworkGraph.tsx:fitCamera',message:'Falling back to recenter',data:{reason:'invalid-or-missing-cache',selfUserId,cachedCamera:cachedCamera??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        recenterGraph(0)
      }

      hasAppliedInitialCameraRef.current = cacheKey
    }

    const timeoutId = window.setTimeout(() => fitCamera(false), 80)
    const secondPassTimeoutId = window.setTimeout(() => fitCamera(true), 420)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(secondPassTimeoutId)
    }
  }, [error, graphSize.height, graphSize.width, loading, maxOrbitRadius, nodes.length, selfUserId])

  useEffect(() => {
    if (
      !graphRef.current ||
      loading ||
      error ||
      nodes.length === 0 ||
      graphSize.width <= 0 ||
      graphSize.height <= 0
    ) {
      return
    }

    // #region agent log
    fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-current',hypothesisId:'H6',location:'NetworkGraph.tsx:recenterEffect',message:'Recenter effect fired',data:{recenterTrigger,loading,error,nodesCount:nodes.length,graphWidth:graphSize.width,graphHeight:graphSize.height},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    recenterGraph(220)
  }, [error, graphSize.height, graphSize.width, loading, nodes.length, recenterTrigger])

  useEffect(() => {
    if (!onGraphStateChange) {
      return
    }

    onGraphStateChange({
      hasConnections: nodes.filter((node) => !node.isSelf).length > 0,
      hasBridges: edges.length > 0,
      loading,
      error,
    })
  }, [edges.length, error, loading, nodes, onGraphStateChange])

  useEffect(() => {
    if (!graphCanvasRef || !graphContainerRef.current) {
      return
    }

    const canvas = graphContainerRef.current.querySelector('canvas')
    if (canvas) {
      graphCanvasRef.current = canvas
    }
  }, [edges.length, graphCanvasRef, nodes.length])

  const pairMeta = useMemo(() => {
    const groupedByPair: Record<string, GraphEdge[]> = {}
    for (const edge of edges) {
      const pairKey = normalizePair(edge.bridge.user_a_id, edge.bridge.user_b_id)
      if (!groupedByPair[pairKey]) {
        groupedByPair[pairKey] = []
      }
      groupedByPair[pairKey].push(edge as GraphEdge)
    }

    const edgeMetaById: Record<
      string,
      { index: number; total: number; pairCount: number }
    > = {}

    for (const pairEdges of Object.values(groupedByPair)) {
      pairEdges.forEach((edge, index) => {
        edgeMetaById[edge.id] = {
          index,
          total: pairEdges.length,
          pairCount: pairEdges.length,
        }
      })
    }

    return edgeMetaById
  }, [edges])

  const dominantBridgeColorByNode = useMemo(() => {
    const dominantColorByNode: Record<string, string> = {}
    const selfNode = nodes.find((node) => node.isSelf)
    if (!selfNode) {
      return dominantColorByNode
    }

    for (const node of nodes) {
      if (node.isSelf) {
        continue
      }

      const sharedBridges = edges
        .map((edge) => edge.bridge)
        .filter(
          (bridge) =>
            (bridge.user_a_id === selfNode.id && bridge.user_b_id === node.id) ||
            (bridge.user_b_id === selfNode.id && bridge.user_a_id === node.id),
        )
      dominantColorByNode[node.id] = getCategoryColor(sharedBridges)
    }

    return dominantColorByNode
  }, [edges, nodes])

  const graphData = useMemo(() => {
    const selfNode = nodes.find((node) => node.isSelf)
    const others = nodes
      .filter((node) => !node.isSelf)
      .sort((a, b) => b.bridgeCount - a.bridgeCount || a.id.localeCompare(b.id))

    const getOrbitPlacement = (index: number) => {
      let ring = 0
      let consumedSlots = 0
      let slotsInRing = 6
      while (index >= consumedSlots + slotsInRing) {
        consumedSlots += slotsInRing
        ring += 1
        slotsInRing = 6 + ring * 4
      }

      const slot = index - consumedSlots
      const angle = (slot / slotsInRing) * Math.PI * 2 - Math.PI / 2
      const radius = 140 + ring * 115

      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      }
    }

    const graphNodes = nodes.map((node) => {
      if (node.isSelf || !selfNode) {
        return {
          ...node,
          x: 0,
          y: 0,
          fx: node.isSelf ? 0 : undefined,
          fy: node.isSelf ? 0 : undefined,
        }
      }

      const index = others.findIndex((other) => other.id === node.id)
      const position = getOrbitPlacement(Math.max(0, index))
      return {
        ...node,
        x: position.x,
        y: position.y,
        fx: position.x,
        fy: position.y,
      }
    }) as GraphNode[]

    const result = {
      nodes: graphNodes,
      links: edges as GraphEdge[],
    }
    // #region agent log
    fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-pre-fix',hypothesisId:'H5',location:'NetworkGraph.tsx:graphData',message:'Built orbit graph data',data:{nodesCount:result.nodes.length,linksCount:result.links.length,maxOrbitRadius,selfUserId,firstNode:result.nodes[0]?.id??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return result
  }, [edges, nodes])

  const nodeCanvasObject = (node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const baseRadius = node.isSelf ? 22 : 18
    const isSelected = selectedUserId === node.id
    const isHovered = hoveredNodeId === node.id
    const scale = isSelected || isHovered ? 1.1 : 1
    const radius = baseRadius * scale
    const borderColor = isSelected || isHovered
      ? dominantBridgeColorByNode[node.id] ?? '#F2EFF8'
      : node.isSelf
        ? '#FFFFFF'
        : 'rgba(255, 255, 255, 0.15)'
    const fillColor = node.isSelf ? '#CF8EE8' : '#272438'

    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false)
    ctx.fillStyle = fillColor
    ctx.fill()

    ctx.lineWidth = node.isSelf ? 2 : 1.5
    ctx.strokeStyle = borderColor
    ctx.stroke()

    const avatarUrl = node.user.avatar_url
    if (avatarUrl && avatarCacheRef.current[avatarUrl]?.complete) {
      const image = avatarCacheRef.current[avatarUrl]
      const imageRadius = radius - 3
      const sourceWidth = image.naturalWidth || image.width
      const sourceHeight = image.naturalHeight || image.height
      const sourceSize = Math.min(sourceWidth, sourceHeight)
      const sourceX = (sourceWidth - sourceSize) / 2
      const sourceY = (sourceHeight - sourceSize) / 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, imageRadius, 0, 2 * Math.PI, false)
      ctx.clip()
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        (node.x ?? 0) - imageRadius,
        (node.y ?? 0) - imageRadius,
        imageRadius * 2,
        imageRadius * 2,
      )
      ctx.restore()
    } else {
      const initial = (node.user.display_name?.trim()[0] ?? '?').toUpperCase()
      ctx.fillStyle = '#F2EFF8'
      ctx.font = `${Math.max(12, radius * 0.9)}px "DM Sans"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initial, node.x ?? 0, node.y ?? 0)
    }

    ctx.font = '10px "DM Sans"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = node.isSelf ? '#F2EFF8' : '#5C5478'
    ctx.fillText(node.isSelf ? 'you' : node.user.display_name, node.x ?? 0, (node.y ?? 0) + radius + 6)
  }

  const nodePointerAreaPaint = (
    node: GraphNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => {
    const baseRadius = node.isSelf ? 22 : 18
    const isSelected = selectedUserId === node.id
    const isHovered = hoveredNodeId === node.id
    const scale = isSelected || isHovered ? 1.1 : 1
    const radius = baseRadius * scale

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 10, 0, 2 * Math.PI, false)
    ctx.fill()
  }

  const linkCanvasObject = (link: GraphEdge, ctx: CanvasRenderingContext2D) => {
    const source = link.source as GraphNode
    const target = link.target as GraphNode
    if (
      typeof source.x !== 'number' ||
      typeof source.y !== 'number' ||
      typeof target.x !== 'number' ||
      typeof target.y !== 'number'
    ) {
      return
    }

    const meta = pairMeta[link.id]
    const total = meta?.total ?? 1
    const index = meta?.index ?? 0
    const offsetIndex = index - (total - 1) / 2
    const dx = target.x - source.x
    const dy = target.y - source.y
    const length = Math.hypot(dx, dy) || 1
    const perpendicularX = -dy / length
    const perpendicularY = dx / length
    const parallelOffset = offsetIndex * 4

    const fromX = source.x + perpendicularX * parallelOffset
    const fromY = source.y + perpendicularY * parallelOffset
    const toX = target.x + perpendicularX * parallelOffset
    const toY = target.y + perpendicularY * parallelOffset

    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.lineWidth = getLinkWidth(meta?.pairCount ?? 1)
    ctx.strokeStyle =
      hoveredEdgeId === link.id
        ? link.bridge.color_hex
        : `${link.bridge.color_hex}B3`
    ctx.stroke()
  }

  return (
    <div ref={graphContainerRef} className="h-full w-full">
      {error ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-playful">
          Something went wrong loading your network.
        </div>
      ) : null}
      {loading || graphSize.width <= 0 || graphSize.height <= 0 ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-text-2">
          Loading your network...
        </div>
      ) : (
        <ForceGraph2D<GraphNode, GraphEdge>
          ref={graphRef}
          width={graphSize.width}
          height={graphSize.height}
          graphData={graphData}
          backgroundColor="#12101A"
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          minZoom={MIN_GRAPH_ZOOM}
          maxZoom={MAX_GRAPH_ZOOM}
          onZoom={(cameraPosition) => {
            if (!selfUserId) {
              return
            }
            if (Date.now() < programmaticCameraUntilRef.current) {
              if (zoomEventCountRef.current < 5) {
                zoomEventCountRef.current += 1
                // #region agent log
                fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-pre-fix',hypothesisId:'H2',location:'NetworkGraph.tsx:onZoom',message:'Ignored programmatic zoom event',data:{cameraX:cameraPosition.x,cameraY:cameraPosition.y,cameraK:cameraPosition.k,programmaticUntil:programmaticCameraUntilRef.current,now:Date.now()},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              }
              return
            }
            if (zoomEventCountRef.current < 10) {
              zoomEventCountRef.current += 1
              // #region agent log
              fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-current',hypothesisId:'H2',location:'NetworkGraph.tsx:onZoom',message:'Persisting user zoom event',data:{cameraX:cameraPosition.x,cameraY:cameraPosition.y,cameraK:cameraPosition.k,graphWidth:graphSize.width,graphHeight:graphSize.height,maxOrbitRadius},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            }
            const maxPanX = maxOrbitRadius + 120
            const maxPanY = maxOrbitRadius + 90
            if (Math.abs(cameraPosition.x) > maxPanX || Math.abs(cameraPosition.y) > maxPanY) {
              // #region agent log
              fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'410ef4'},body:JSON.stringify({sessionId:'410ef4',runId:'run-current',hypothesisId:'H7',location:'NetworkGraph.tsx:onZoom',message:'Camera exceeded soft viewport bounds',data:{cameraX:cameraPosition.x,cameraY:cameraPosition.y,cameraK:cameraPosition.k,maxPanX,maxPanY,maxOrbitRadius},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            }
            graphCameraCacheByUserId.set(selfUserId, {
              x: cameraPosition.x,
              y: cameraPosition.y,
              k: cameraPosition.k,
            })
          }}
          linkVisibility={(link) => {
            if (!selectedUserId) {
              return false
            }
            const sourceId =
              typeof link.source === 'string' ? link.source : link.source.id
            const targetId =
              typeof link.target === 'string' ? link.target : link.target.id
            return sourceId === selectedUserId || targetId === selectedUserId
          }}
          nodeCanvasObject={(node, ctx) => nodeCanvasObject(node as GraphNode, ctx)}
          nodePointerAreaPaint={(node, color, ctx) =>
            nodePointerAreaPaint(node as GraphNode, color, ctx)
          }
          linkCanvasObject={(link, ctx) => linkCanvasObject(link as GraphEdge, ctx)}
          linkHoverPrecision={8}
          onNodeClick={(node) => {
            const selectedNode = node as GraphNode
            onNodeSelect(selectedNode.id)
            onBridgeSelect?.(null)
          }}
          onNodeHover={(node) => {
            setHoveredNodeId((node as GraphNode | null)?.id ?? null)
          }}
          onLinkHover={(link) => {
            setHoveredEdgeId((link as GraphEdge | null)?.id ?? null)
          }}
          onLinkClick={(link) => {
            const selectedEdge = link as GraphEdge
            onBridgeSelect?.(selectedEdge.bridge)
          }}
          onBackgroundClick={() => {
            onNodeSelect(null)
            onBridgeSelect?.(null)
          }}
        />
      )}
    </div>
  )
}
