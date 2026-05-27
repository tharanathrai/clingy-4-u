import { CATEGORIES, type CategorySlug } from './constants.ts'
import type { Bridge } from '../types/index.ts'

const CATEGORY_SLUG_ORDER = Object.keys(CATEGORIES) as CategorySlug[]

const toCategorySlug = (value: string): CategorySlug | null => {
  const normalized = value.trim().toLowerCase()
  if (normalized in CATEGORIES) {
    return normalized as CategorySlug
  }
  return null
}

export const getPairLinkDistance = (pairCount: number): number => {
  const count = Math.max(1, pairCount)
  return Math.max(56, 118 - count * 11)
}

export const getMajorityBridgeColor = (bridges: Bridge[]): string => {
  if (bridges.length === 0) {
    return CATEGORIES.intimate.color_hex
  }

  const counts: Partial<Record<CategorySlug, number>> = {}
  for (const bridge of bridges) {
    const slug = toCategorySlug(bridge.category)
    if (!slug) {
      continue
    }
    counts[slug] = (counts[slug] ?? 0) + 1
  }

  let bestSlug: CategorySlug | null = null
  let bestCount = 0

  for (const slug of CATEGORY_SLUG_ORDER) {
    const count = counts[slug] ?? 0
    if (count > bestCount) {
      bestCount = count
      bestSlug = slug
    }
  }

  if (bestSlug) {
    return CATEGORIES[bestSlug].color_hex
  }

  return bridges[0]?.color_hex ?? CATEGORIES.intimate.color_hex
}
