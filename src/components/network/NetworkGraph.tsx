import { forceCollide, forceX, forceY } from 'd3-force'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import type { Bridge } from '../../types/index.ts'
import type { NetworkGraphEdge, NetworkGraphNode } from '../../hooks/useNetworkGraph.ts'

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
  nodes: NetworkGraphNode[]
  edges: NetworkGraphEdge[]
  loading: boolean
  error: string | null
  selectedNodeId: string | null
  recenterTrigger: number
  onNodeSelect: (userId: string | null) => void
  onBridgeSelect: (bridge: Bridge | null) => void
  onBackgroundClick: () => void
  graphCanvasRef?: MutableRefObject<HTMLCanvasElement | null>
}

const BASE_RADIUS = 14
const SELF_RADIUS = 28

const getPairKey = (source: string, target: string): string => {
  return [source, target].sort().join(':')
}

const getEdgeWidth = (bridgeCount: number): number => {
  if (bridgeCount >= 5) {
    return 4
  }
  if (bridgeCount === 4) {
    return 3
  }
  if (bridgeCount === 3) {
    return 2.5
  }
  if (bridgeCount === 2) {
    return 2
  }
  return 1.5
}

const getDistanceByBridgeCount = (bridgeCount: number): number => {
  if (bridgeCount >= 5) {
    return 55
  }
  if (bridgeCount === 4) {
    return 75
  }
  if (bridgeCount === 3) {
    return 100
  }
  if (bridgeCount === 2) {
    return 130
  }
  return 160
}

const getStrengthByBridgeCount = (bridgeCount: number): number => {
  if (bridgeCount >= 5) {
    return 0.5
  }
  if (bridgeCount === 4) {
    return 0.35
  }
  if (bridgeCount === 3) {
    return 0.2
  }
  if (bridgeCount === 2) {
    return 0.1
  }
  return 0.05
}

const hexToRgba = (color: string, alpha: number): string => {
  const normalized = color.replace('#', '')
  if (normalized.length !== 6) {
    return `rgba(255,255,255,${alpha})`
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getInitials = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '?'
  }
  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]?.[0] ?? ''
  const second = tokens[1]?.[0] ?? ''
  return `${first}${second}`.toUpperCase() || first.toUpperCase() || '?'
}

function NetworkGraphComponent({
  nodes,
  edges,
  loading,
  error,
  selectedNodeId,
  recenterTrigger,
  onNodeSelect,
  onBridgeSelect,
  onBackgroundClick,
  graphCanvasRef,
}: NetworkGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | undefined>(undefined)
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const avatarCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const releaseSelfPinTimeoutRef = useRef<number | null>(null)
  const hasInitializedRef = useRef(false)
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const selfNodeId = useMemo(() => {
    return nodes.find((node) => node.isSelf)?.id ?? null
  }, [nodes])

  const pairBridgeCount = useMemo(() => {
    const byPair = new Map<string, number>()
    for (const edge of edges) {
      const key = getPairKey(edge.source, edge.target)
      byPair.set(key, (byPair.get(key) ?? 0) + 1)
    }
    return byPair
  }, [edges])

  const dominantColorByNodeId = useMemo(() => {
    if (!selfNodeId) {
      return new Map<string, string>()
    }

    const byNode = new Map<string, Map<string, number>>()
    for (const edge of edges) {
      const otherNodeId =
        edge.source === selfNodeId
          ? edge.target
          : edge.target === selfNodeId
            ? edge.source
            : null
      if (!otherNodeId) {
        continue
      }

      const currentCounts = byNode.get(otherNodeId) ?? new Map<string, number>()
      currentCounts.set(edge.bridge.color_hex, (currentCounts.get(edge.bridge.color_hex) ?? 0) + 1)
      byNode.set(otherNodeId, currentCounts)
    }

    const result = new Map<string, string>()
    for (const [nodeId, counts] of byNode.entries()) {
      const top = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]
      if (top) {
        result.set(nodeId, top[0])
      }
    }
    return result
  }, [edges, selfNodeId])

  const visibleEdgeMetaById = useMemo(() => {
    if (!selectedNodeId) {
      return new Map<string, { index: number; total: number; pairCount: number }>()
    }

    const visible = edges.filter(
      (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId,
    )
    const groupedByPair = new Map<string, NetworkGraphEdge[]>()

    for (const edge of visible) {
      const key = getPairKey(edge.source, edge.target)
      const group = groupedByPair.get(key) ?? []
      group.push(edge)
      groupedByPair.set(key, group)
    }

    const byId = new Map<string, { index: number; total: number; pairCount: number }>()
    for (const [pairKey, group] of groupedByPair.entries()) {
      const pairCount = pairBridgeCount.get(pairKey) ?? group.length
      group.forEach((edge, index) => {
        byId.set(edge.id, {
          index,
          total: group.length,
          pairCount,
        })
      })
    }

    return byId
  }, [edges, pairBridgeCount, selectedNodeId])

  const graphData = useMemo(() => {
    const centerX = viewport.width / 2
    const centerY = viewport.height / 2
    const nonSelf = nodes.filter((node) => !node.isSelf)

    const mappedNodes = nodes.map((node) => {
      if (node.isSelf) {
        return {
          ...node,
          x: centerX,
          y: centerY,
          fx: centerX,
          fy: centerY,
        }
      }

      const index = nonSelf.findIndex((otherNode) => otherNode.id === node.id)
      const angle = (index / Math.max(nonSelf.length, 1)) * Math.PI * 2
      const radius = 90 + (index % 5) * 25
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    }) as GraphNode[]

    return {
      nodes: mappedNodes,
      links: edges as GraphEdge[],
    }
  }, [edges, nodes, viewport.height, viewport.width])

  const clampNodeToBounds = useCallback(
    (node: GraphNode) => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        return
      }

      const isSelected = selectedNodeId === node.id
      const isHovered = hoveredNodeId === node.id
      const radius = node.isSelf ? SELF_RADIUS : isSelected || isHovered ? 16 : BASE_RADIUS

      const minX = radius
      const maxX = viewport.width - radius
      const minY = radius
      const maxY = viewport.height - radius

      node.x = Math.max(minX, Math.min(maxX, node.x))
      node.y = Math.max(minY, Math.min(maxY, node.y))
    },
    [hoveredNodeId, selectedNodeId, viewport.height, viewport.width],
  )

  const recenterGraph = useCallback(() => {
    const graph = graphRef.current
    const centerX = viewport.width / 2
    const centerY = viewport.height / 2
    const selfNode = graphData.nodes.find((node) => node.isSelf)
    if (!graph || !selfNode) {
      return
    }

    selfNode.fx = centerX
    selfNode.fy = centerY
    selfNode.x = centerX
    selfNode.y = centerY
    selfNode.vx = 0
    selfNode.vy = 0

    graph.centerAt(centerX, centerY, 400)
    graph.zoom(1, 400)

    if (releaseSelfPinTimeoutRef.current) {
      window.clearTimeout(releaseSelfPinTimeoutRef.current)
    }
    releaseSelfPinTimeoutRef.current = window.setTimeout(() => {
      selfNode.fx = undefined
      selfNode.fy = undefined
      releaseSelfPinTimeoutRef.current = null
    }, 1000)
  }, [graphData.nodes, viewport.height, viewport.width])

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener('resize', updateViewport)
    return () => {
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  useEffect(() => {
    for (const node of nodes) {
      if (!node.user.avatar_url || avatarCacheRef.current.has(node.id)) {
        continue
      }

      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = node.user.avatar_url
      avatarCacheRef.current.set(node.id, image)
    }
  }, [nodes])

  useEffect(() => {
    if (!graphCanvasRef || !graphContainerRef.current) {
      return
    }
    const canvas = graphContainerRef.current.querySelector('canvas')
    if (canvas) {
      graphCanvasRef.current = canvas
    }
  }, [graphCanvasRef, viewport.height, viewport.width])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || loading || error || graphData.nodes.length === 0) {
      return
    }

    const linkForce = graph.d3Force('link') as
      | {
          distance: (value: (link: GraphEdge) => number) => void
          strength: (value: (link: GraphEdge) => number) => void
        }
      | undefined

    linkForce?.distance((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      const pairCount = pairBridgeCount.get(getPairKey(sourceId, targetId)) ?? 1
      return getDistanceByBridgeCount(pairCount)
    })

    linkForce?.strength((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      const pairCount = pairBridgeCount.get(getPairKey(sourceId, targetId)) ?? 1
      return getStrengthByBridgeCount(pairCount)
    })

    const chargeForce = graph.d3Force('charge') as { strength: (value: number) => void } | undefined
    chargeForce?.strength(-180)

    graph.d3Force(
      'collide',
      forceCollide<GraphNode>((node) => (node.isSelf ? 36 : 24)).strength(0.8),
    )

    const centerX = viewport.width / 2
    const centerY = viewport.height / 2
    graph.d3Force('x', forceX<GraphNode>(centerX).strength((node) => (node.isSelf ? 0.05 : 0)))
    graph.d3Force('y', forceY<GraphNode>(centerY).strength((node) => (node.isSelf ? 0.05 : 0)))
  }, [
    error,
    graphData.nodes.length,
    loading,
    pairBridgeCount,
    viewport.height,
    viewport.width,
  ])

  useEffect(() => {
    if (loading || error || graphData.nodes.length === 0) {
      return
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      recenterGraph()
    }
  }, [error, graphData.nodes.length, loading, recenterGraph])

  useEffect(() => {
    if (!hasInitializedRef.current || loading || error || graphData.nodes.length === 0) {
      return
    }
    recenterGraph()
  }, [error, graphData.nodes.length, loading, recenterGraph, recenterTrigger])

  useEffect(() => {
    if (!graphContainerRef.current) {
      return
    }
    graphContainerRef.current.style.cursor = hoveredNodeId ? 'pointer' : 'default'
  }, [hoveredNodeId])

  const drawNode = (node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const isSelected = selectedNodeId === node.id
    const isHovered = hoveredNodeId === node.id
    const isActiveOther = !node.isSelf && (isSelected || isHovered)
    const radius = node.isSelf ? SELF_RADIUS : isActiveOther ? 16 : BASE_RADIUS
    const dominantColor = dominantColorByNodeId.get(node.id) ?? '#9B93B8'

    const strokeColor = node.isSelf
      ? '#FFFFFF'
      : isSelected
        ? dominantColor
        : isHovered
          ? hexToRgba(dominantColor, 0.6)
          : 'rgba(255,255,255,0.15)'
    const strokeWidth = node.isSelf ? 2.5 : isActiveOther ? 2.5 : 1.5
    const fillColor = node.isSelf ? '#CF8EE8' : '#272438'

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = strokeColor
    ctx.stroke()

    const image = avatarCacheRef.current.get(node.id)
    const avatarInset = node.isSelf ? 3.5 : 2.5
    const avatarRadius = radius - avatarInset

    if (image?.complete) {
      const sourceWidth = image.naturalWidth || image.width
      const sourceHeight = image.naturalHeight || image.height
      const sourceSize = Math.min(sourceWidth, sourceHeight)
      const sourceX = (sourceWidth - sourceSize) / 2
      const sourceY = (sourceHeight - sourceSize) / 2

      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, avatarRadius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        x - avatarRadius,
        y - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2,
      )
      ctx.restore()
    } else {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = node.isSelf ? `500 14px "DM Sans"` : `500 10px "DM Sans"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(getInitials(node.user.display_name), x, y)
    }

    ctx.fillStyle = node.isSelf ? '#9B93B8' : '#5C5478'
    ctx.font = node.isSelf ? `400 11px "DM Sans"` : `400 10px "DM Sans"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(node.isSelf ? 'you' : node.user.display_name, x, y + radius + 10)
  }

  const drawNodePointerArea = (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    const radius = node.isSelf ? SELF_RADIUS + 4 : 18
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawEdge = (edge: GraphEdge, ctx: CanvasRenderingContext2D) => {
    const meta = visibleEdgeMetaById.get(edge.id)
    if (!meta) {
      return
    }

    const source = edge.source as GraphNode
    const target = edge.target as GraphNode
    if (
      typeof source.x !== 'number' ||
      typeof source.y !== 'number' ||
      typeof target.x !== 'number' ||
      typeof target.y !== 'number'
    ) {
      return
    }

    const dx = target.x - source.x
    const dy = target.y - source.y
    const length = Math.hypot(dx, dy) || 1
    const normalX = -dy / length
    const normalY = dx / length
    const offset = (meta.index - (meta.total - 1) / 2) * 5

    const fromX = source.x + normalX * offset
    const fromY = source.y + normalY * offset
    const toX = target.x + normalX * offset
    const toY = target.y + normalY * offset

    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.lineWidth = getEdgeWidth(meta.pairCount)
    ctx.strokeStyle = hexToRgba(edge.bridge.color_hex, 0.75)
    ctx.stroke()
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-sm text-playful">
        Something went wrong loading your network.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-sm text-text-2">
        Loading your network...
      </div>
    )
  }

  return (
    <div ref={graphContainerRef} className="h-screen w-screen overflow-hidden bg-bg">
      <ForceGraph2D<GraphNode, GraphEdge>
        ref={graphRef}
        width={viewport.width}
        height={viewport.height}
        graphData={graphData}
        backgroundColor="#12101A"
        nodeCanvasObject={(node, ctx) => drawNode(node as GraphNode, ctx)}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={(node, color, ctx) =>
          drawNodePointerArea(node as GraphNode, color, ctx)
        }
        linkCanvasObject={(link, ctx) => drawEdge(link as GraphEdge, ctx)}
        linkCanvasObjectMode={() => 'replace'}
        linkVisibility={(link) => visibleEdgeMetaById.has((link as GraphEdge).id)}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        enablePanInteraction={false}
        enableZoomInteraction
        minZoom={0.4}
        maxZoom={3}
        onNodeHover={(node) => {
          const nextNodeId = (node as GraphNode | null)?.id ?? null
          setHoveredNodeId(nextNodeId)
        }}
        onNodeClick={(node) => {
          const graphNode = node as GraphNode
          if (graphNode.isSelf) {
            return
          }

          onBridgeSelect(null)
          onNodeSelect(selectedNodeId === graphNode.id ? null : graphNode.id)
        }}
        onBackgroundClick={() => {
          onBackgroundClick()
          onBridgeSelect(null)
        }}
        onLinkClick={(link) => {
          const graphEdge = link as GraphEdge
          if (!visibleEdgeMetaById.has(graphEdge.id)) {
            return
          }
          onBridgeSelect(graphEdge.bridge)
        }}
        onNodeDrag={(node) => {
          const graphNode = node as GraphNode
          if (!graphNode.isSelf && selectedNodeId !== graphNode.id) {
            onNodeSelect(graphNode.id)
          }
          onBridgeSelect(null)
          clampNodeToBounds(graphNode)
          graphNode.fx = graphNode.x
          graphNode.fy = graphNode.y
        }}
        onNodeDragEnd={(node) => {
          const graphNode = node as GraphNode
          clampNodeToBounds(graphNode)
          graphNode.fx = undefined
          graphNode.fy = undefined
        }}
        onEngineTick={() => {
          for (const node of graphData.nodes) {
            clampNodeToBounds(node)
          }
        }}
      />
    </div>
  )
}

export const NetworkGraph = memo(NetworkGraphComponent)
