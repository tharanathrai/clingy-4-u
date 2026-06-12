import { CATEGORIES, type CategorySlug } from './constants.ts'
import type { NetworkGraphEdge, NetworkGraphNode } from '../hooks/useNetworkGraph.ts'

const CATEGORY_ORDER = Object.keys(CATEGORIES) as CategorySlug[]

const ACCENT_COLOR = CATEGORIES.intimate.color_hex

export interface NetworkShareStats {
  peopleCount: number
  bridgeCount: number
  glowColor: string
}

export const getFirstName = (displayName: string): string => {
  const trimmed = displayName.trim()
  if (!trimmed) {
    return '?'
  }
  return trimmed.split(/\s+/)[0] ?? trimmed
}

export const formatShareStatLine = (peopleCount: number, bridgeCount: number): string => {
  const peopleLabel = peopleCount === 1 ? 'person' : 'people'
  const bridgeLabel = bridgeCount === 1 ? 'bridge' : 'bridges'
  return `${peopleCount} ${peopleLabel} · ${bridgeCount} ${bridgeLabel}`
}

export const getDominantBridgeCategoryColor = (edges: NetworkGraphEdge[]): string => {
  if (edges.length === 0) {
    return ACCENT_COLOR
  }

  const counts: Partial<Record<CategorySlug, number>> = {}
  for (const edge of edges) {
    const slug = edge.bridge.category as CategorySlug
    if (!(slug in CATEGORIES)) {
      continue
    }
    counts[slug] = (counts[slug] ?? 0) + 1
  }

  let bestSlug: CategorySlug = CATEGORY_ORDER[0]
  let bestCount = -1
  for (const slug of CATEGORY_ORDER) {
    const count = counts[slug] ?? 0
    if (count > bestCount) {
      bestCount = count
      bestSlug = slug
    }
  }

  return CATEGORIES[bestSlug].color_hex
}

export const getNetworkShareStats = (
  nodes: NetworkGraphNode[],
  edges: NetworkGraphEdge[],
): NetworkShareStats => {
  const peopleCount = nodes.filter((node) => !node.isSelf && node.bridgeCount > 0).length
  const bridgeCount = edges.length
  const glowColor = getDominantBridgeCategoryColor(edges)

  return { peopleCount, bridgeCount, glowColor }
}

export const getExportLabelNodeIds = (nodes: NetworkGraphNode[], limit = 5): Set<string> => {
  const ranked = nodes
    .filter((node) => !node.isSelf && node.bridgeCount > 0)
    .sort((left, right) => right.bridgeCount - left.bridgeCount)
    .slice(0, limit)

  return new Set(ranked.map((node) => node.id))
}
