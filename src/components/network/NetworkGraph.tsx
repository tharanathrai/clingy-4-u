import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { forceCollide } from 'd3-force'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import type { Bridge } from '../../types/index.ts'
import {
  useNetworkGraph,
  type NetworkGraphEdge,
  type NetworkGraphNode,
} from '../../hooks/useNetworkGraph.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

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

const MIN_GRAPH_ZOOM = 0.45
const MAX_GRAPH_ZOOM = 3.25
const CAMERA_CLAMP_EPSILON = 0.5
const MOBILE_POINTER_BOOST = 1.35

const getLinkWidth = (count: number): number => {
  if (count >= 5) {
    return 4
  }
  if (count >= 3) {
    return 2.7
  }
  return 1.7
}

const normalizePair = (left: string, right: string): string => {
  return [left, right].sort().join(':')
}

export function NetworkGraph({
  onNodeSelect,
  selectedUserId,
  onBridgeSelect,
  onGraphStateChange,
  graphCanvasRef,
  recenterTrigger = 0,
}: NetworkGraphProps) {
  const { nodes, edges, loading, error, refetch } = useNetworkGraph()
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | undefined>(
    undefined,
  )
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const avatarCacheRef = useRef<Record<string, HTMLImageElement>>({})
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const hasAppliedInitialRecenterRef = useRef(false)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const pointerMovedRef = useRef(false)
  const lastSelectionTsRef = useRef(0)

  const clearSelection = () => {
    const msSinceSelection = Date.now() - lastSelectionTsRef.current
    if (msSinceSelection < 250) {
      return
    }
    onNodeSelect(null)
    onBridgeSelect?.(null)
  }

  const selectNode = (nodeId: string | null) => {
    lastSelectionTsRef.current = Date.now()
    onNodeSelect(nodeId)
    onBridgeSelect?.(null)
  }

  useEffect(() => {
    for (const node of nodes) {
      const transformedUrl = withAvatarSize(node.user.avatar_url, node.isSelf ? 72 : 48)
      if (!transformedUrl || avatarCacheRef.current[transformedUrl]) {
        continue
      }
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = transformedUrl
      avatarCacheRef.current[transformedUrl] = image
    }
  }, [nodes])

  useEffect(() => {
    const updateSize = () => {
      const container = graphContainerRef.current
      if (!container) {
        return
      }
      const bounds = container.getBoundingClientRect()
      setGraphSize({
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height)),
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

  const worldBounds = useMemo(() => {
    const nonSelfCount = nodes.filter((node) => !node.isSelf).length
    const ringCount = Math.max(1, Math.ceil(nonSelfCount / 8))
    const maxRadius = 140 + Math.max(0, ringCount - 1) * 110
    return {
      left: -(maxRadius + 130),
      right: maxRadius + 130,
      top: -(maxRadius + 130),
      bottom: maxRadius + 180,
      maxRadius,
    }
  }, [nodes])

  const recenterGraph = useCallback((duration = 240) => {
    const bounds = graphContainerRef.current?.getBoundingClientRect()
    const width = Math.round(bounds?.width ?? graphSize.width)
    const height = Math.round(bounds?.height ?? graphSize.height)
    if (width <= 0 || height <= 0) {
      return
    }

    const padding = width < 640 ? 24 : 72
    const usableWidth = Math.max(1, width - padding * 2)
    const usableHeight = Math.max(1, height - padding * 2)
    const worldWidth = worldBounds.right - worldBounds.left
    const worldHeight = worldBounds.bottom - worldBounds.top
    const zoom = Math.max(
      MIN_GRAPH_ZOOM,
      Math.min(
        1.2,
        Math.min(usableWidth / Math.max(1, worldWidth), usableHeight / Math.max(1, worldHeight)),
      ),
    )

    graphRef.current?.centerAt(0, 20, duration)
    graphRef.current?.zoom(zoom, duration)
  }, [graphSize.height, graphSize.width, worldBounds.bottom, worldBounds.left, worldBounds.right, worldBounds.top])

  const pairMeta = useMemo(() => {
    const groupedByPair: Record<string, GraphEdge[]> = {}
    for (const edge of edges) {
      const pairKey = normalizePair(edge.bridge.user_a_id, edge.bridge.user_b_id)
      if (!groupedByPair[pairKey]) {
        groupedByPair[pairKey] = []
      }
      groupedByPair[pairKey].push(edge as GraphEdge)
    }

    const edgeMetaById: Record<string, { index: number; total: number; pairCount: number }> = {}
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

  useEffect(() => {
    if (!graphRef.current || loading || error || nodes.length === 0) {
      return
    }

    const linkForce = graphRef.current.d3Force('link') as
      | {
          distance?: (value: (link: GraphEdge) => number) => void
          strength?: (value: (link: GraphEdge) => number) => void
        }
      | undefined
    linkForce?.distance?.((link) => {
      const pairCount = pairMeta[link.id]?.pairCount ?? 1
      return Math.max(56, 118 - pairCount * 11)
    })
    linkForce?.strength?.((link) => {
      const pairCount = pairMeta[link.id]?.pairCount ?? 1
      return Math.min(0.9, 0.32 + pairCount * 0.09)
    })

    const chargeForce = graphRef.current.d3Force('charge') as
      | { strength?: (value: number) => void }
      | undefined
    chargeForce?.strength?.(-145)

    graphRef.current.d3Force(
      'collide',
      forceCollide<GraphNode>((node) => (node.isSelf ? 48 : 28)).strength(0.98),
    )
  }, [error, loading, nodes.length, pairMeta])

  useEffect(() => {
    if (!graphRef.current || loading || error || nodes.length === 0) {
      return
    }

    if (hasAppliedInitialRecenterRef.current) {
      return
    }

    hasAppliedInitialRecenterRef.current = true
    recenterGraph(0)
  }, [error, graphSize.height, graphSize.width, loading, nodes.length, recenterGraph, worldBounds.maxRadius])

  useEffect(() => {
    if (!graphRef.current || loading || error || nodes.length === 0) {
      return
    }
    recenterGraph(220)
  }, [error, loading, nodes.length, recenterGraph, recenterTrigger])

  useEffect(() => {
    if (!onGraphStateChange) {
      return
    }

    onGraphStateChange({
      hasConnections: nodes.some((node) => !node.isSelf),
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

  const graphData = useMemo(() => {
    const selfNode = nodes.find((node) => node.isSelf)
    const others = nodes.filter((node) => !node.isSelf)

    const graphNodes = nodes.map((node) => {
      if (node.isSelf || !selfNode) {
        return {
          ...node,
          x: 0,
          y: 0,
          fx: 0,
          fy: 0,
        }
      }

      const index = others.findIndex((other) => other.id === node.id)
      const angle = (index / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2
      const radius = Math.min(worldBounds.maxRadius, 130 + index * 16)
      return {
        ...node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      }
    }) as GraphNode[]

    return {
      nodes: graphNodes,
      links: edges as GraphEdge[],
    }
  }, [edges, nodes, worldBounds.maxRadius])

  const nodeCanvasObject = (node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const baseRadius = node.isSelf ? 36 : 18
    const isSelected = selectedUserId === node.id
    const isHovered = hoveredNodeId === node.id
    const radius = baseRadius * (isSelected || isHovered ? 1.1 : 1)
    const fill = node.isSelf ? '#1E1B2E' : '#272438'
    const stroke = node.isSelf
      ? '#CF8EE8'
      : isSelected || isHovered
        ? '#F2EFF8'
        : 'rgba(255,255,255,0.2)'

    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = node.isSelf ? 3 : 1.5
    ctx.strokeStyle = stroke
    ctx.stroke()

    const avatarUrl = withAvatarSize(node.user.avatar_url, node.isSelf ? 72 : 48)
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
      ctx.arc(node.x ?? 0, node.y ?? 0, imageRadius, 0, 2 * Math.PI)
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
  }

  const nodePointerAreaPaint = (
    node: GraphNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => {
    const pointerBoost = window.matchMedia('(max-width: 640px)').matches
      ? MOBILE_POINTER_BOOST
      : 1
    const radius = (node.isSelf ? 40 : 24) * pointerBoost
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI)
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
    ctx.strokeStyle = hoveredEdgeId === link.id ? link.bridge.color_hex : `${link.bridge.color_hex}A6`
    ctx.stroke()
  }

  const selfNodeId = useMemo(() => {
    return nodes.find((node) => node.isSelf)?.id ?? null
  }, [nodes])

  const isSelectedPairLink = (link: GraphEdge): boolean => {
    if (!selectedUserId || !selfNodeId) {
      return false
    }
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id
    return (
      (sourceId === selfNodeId && targetId === selectedUserId) ||
      (sourceId === selectedUserId && targetId === selfNodeId)
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-text-2">Couldn&apos;t load your network. Try again.</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
        >
          Retry
        </button>
      </div>
    )
  }

  if (loading || graphSize.width <= 0 || graphSize.height <= 0) {
    return (
      <div ref={graphContainerRef} className="flex h-full w-full items-center justify-center">
        <div className="relative h-32 w-32">
          <span className="network-node-pulse absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40" />
          <span className="network-node-pulse network-node-delay-1 absolute left-4 top-7 h-8 w-8 rounded-full bg-explore/50" />
          <span className="network-node-pulse network-node-delay-2 absolute right-4 top-9 h-7 w-7 rounded-full bg-active/50" />
          <span className="network-node-pulse network-node-delay-3 absolute bottom-4 left-8 h-7 w-7 rounded-full bg-playful/50" />
          <span className="network-node-pulse network-node-delay-4 absolute bottom-6 right-7 h-9 w-9 rounded-full bg-intimate/50" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={graphContainerRef}
      className="h-full w-full"
      onPointerDown={(event) => {
        pointerDownRef.current = { x: event.clientX, y: event.clientY }
        pointerMovedRef.current = false
      }}
      onPointerMove={(event) => {
        const start = pointerDownRef.current
        if (!start) {
          return
        }

        const deltaX = event.clientX - start.x
        const deltaY = event.clientY - start.y
        if (Math.hypot(deltaX, deltaY) > 8) {
          pointerMovedRef.current = true
        }
      }}
      onPointerUp={(event) => {
        const start = pointerDownRef.current
        pointerDownRef.current = null
        if (!start || pointerMovedRef.current) {
          return
        }

        const graphMethods = graphRef.current as unknown as {
          graph2ScreenCoords?: (x: number, y: number) => { x: number; y: number }
        }
        if (!graphMethods.graph2ScreenCoords) {
          return
        }

        const rect = graphContainerRef.current?.getBoundingClientRect()
        if (!rect) {
          return
        }

        const clickX = event.clientX - rect.left
        const clickY = event.clientY - rect.top
        const tapThreshold = window.matchMedia('(pointer: coarse)').matches ? 42 : 30

        let nearestNode: GraphNode | null = null
        let nearestDistance = Number.POSITIVE_INFINITY

        for (const node of graphData.nodes) {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') {
            continue
          }

          const point = graphMethods.graph2ScreenCoords(node.x, node.y)
          const distance = Math.hypot(point.x - clickX, point.y - clickY)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestNode = node
          }
        }

        if (!nearestNode || nearestDistance > tapThreshold) {
          return
        }

        if (nearestNode.isSelf) {
          clearSelection()
          return
        }

        if (selectedUserId !== nearestNode.id) {
          selectNode(nearestNode.id)
        }
      }}
    >
      <ForceGraph2D<GraphNode, GraphEdge>
        ref={graphRef}
        width={graphSize.width}
        height={graphSize.height}
        graphData={graphData}
        backgroundColor="#12101A"
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.22}
        cooldownTicks={Infinity}
        minZoom={MIN_GRAPH_ZOOM}
        maxZoom={MAX_GRAPH_ZOOM}
        onZoom={(cameraPosition) => {
          const worldLeft = worldBounds.left
          const worldRight = worldBounds.right
          const worldTop = worldBounds.top
          const worldBottom = worldBounds.bottom
          const halfViewportWidth = graphSize.width / (2 * Math.max(cameraPosition.k, 0.0001))
          const halfViewportHeight = graphSize.height / (2 * Math.max(cameraPosition.k, 0.0001))

          const minCameraX = worldLeft + halfViewportWidth
          const maxCameraX = worldRight - halfViewportWidth
          const minCameraY = worldTop + halfViewportHeight
          const maxCameraY = worldBottom - halfViewportHeight

          const clampedX =
            minCameraX <= maxCameraX
              ? Math.max(minCameraX, Math.min(maxCameraX, cameraPosition.x))
              : 0
          const clampedY =
            minCameraY <= maxCameraY
              ? Math.max(minCameraY, Math.min(maxCameraY, cameraPosition.y))
              : 20

          const needsClamp =
            Math.abs(clampedX - cameraPosition.x) > CAMERA_CLAMP_EPSILON ||
            Math.abs(clampedY - cameraPosition.y) > CAMERA_CLAMP_EPSILON

          if (needsClamp) {
            graphRef.current?.centerAt(clampedX, clampedY, 0)
          }
        }}
        linkVisibility={(link) => isSelectedPairLink(link as GraphEdge)}
        nodeCanvasObject={(node, ctx) => nodeCanvasObject(node as GraphNode, ctx)}
        nodePointerAreaPaint={(node, color, ctx) =>
          nodePointerAreaPaint(node as GraphNode, color, ctx)
        }
        linkCanvasObject={(link, ctx) => linkCanvasObject(link as GraphEdge, ctx)}
        linkHoverPrecision={12}
        onNodeClick={(node) => {
          const selectedNode = node as GraphNode
          if (selectedNode.isSelf) {
            clearSelection()
            return
          }
          selectNode(selectedNode.id)
        }}
        onNodeHover={(node) => {
          setHoveredNodeId((node as GraphNode | null)?.id ?? null)
        }}
        onLinkHover={(link) => {
          setHoveredEdgeId((link as GraphEdge | null)?.id ?? null)
        }}
        onLinkClick={(link) => {
          onBridgeSelect?.((link as GraphEdge).bridge)
        }}
        onBackgroundClick={() => {
          clearSelection()
        }}
        onEngineTick={() => {
          const graphNodes = graphData.nodes
          const selfNode = graphNodes.find((node) => node.isSelf)
          const otherNodes = graphNodes.filter((node) => !node.isSelf)
          for (const node of graphNodes) {
            if (node.isSelf) {
              node.x = 0
              node.y = 0
              node.vx = 0
              node.vy = 0
              node.fx = 0
              node.fy = 0
              continue
            }

            if (typeof node.x !== 'number' || typeof node.y !== 'number') {
              continue
            }

            const clampedX = Math.max(worldBounds.left, Math.min(worldBounds.right, node.x))
            const clampedY = Math.max(worldBounds.top, Math.min(worldBounds.bottom, node.y))
            if (clampedX !== node.x) {
              node.x = clampedX
              node.vx = (node.vx ?? 0) * -0.45
            }
            if (clampedY !== node.y) {
              node.y = clampedY
              node.vy = (node.vy ?? 0) * -0.45
            }
          }

          if (
            selfNode &&
            typeof selfNode.x === 'number' &&
            typeof selfNode.y === 'number'
          ) {
            const minimumDistanceFromSelf = 92
            for (const node of otherNodes) {
              if (typeof node.x !== 'number' || typeof node.y !== 'number') {
                continue
              }
              const dx = node.x - selfNode.x
              const dy = node.y - selfNode.y
              const distance = Math.hypot(dx, dy)
              if (distance >= minimumDistanceFromSelf) {
                continue
              }
              const ux = distance > 0 ? dx / distance : 1
              const uy = distance > 0 ? dy / distance : 0
              node.x = selfNode.x + ux * minimumDistanceFromSelf
              node.y = selfNode.y + uy * minimumDistanceFromSelf
              node.vx = (node.vx ?? 0) * 0.2
              node.vy = (node.vy ?? 0) * 0.2
            }
          }
        }}
        onNodeDrag={(node) => {
          const dragged = node as GraphNode
          if (dragged.isSelf) {
            dragged.x = 0
            dragged.y = 0
            dragged.fx = 0
            dragged.fy = 0
            return
          }

          if (selectedUserId !== dragged.id) {
            selectNode(dragged.id)
          }

          const nextX = Math.max(worldBounds.left, Math.min(worldBounds.right, dragged.x ?? 0))
          const nextY = Math.max(worldBounds.top, Math.min(worldBounds.bottom, dragged.y ?? 0))
          dragged.x = nextX
          dragged.y = nextY
          dragged.fx = nextX
          dragged.fy = nextY
        }}
        onNodeDragEnd={(node) => {
          const dragged = node as GraphNode
          if (dragged.isSelf) {
            dragged.fx = 0
            dragged.fy = 0
            return
          }

          dragged.fx = undefined
          dragged.fy = undefined
        }}
      />
    </div>
  )
}
