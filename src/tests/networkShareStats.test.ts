/**
 * Tests for network share stats helpers (spec 016-social-share-export)
 */

import { describe, expect, it } from 'vitest'
import {
  formatShareStatLine,
  getDominantBridgeCategoryColor,
  getExportLabelNodeIds,
  getFirstName,
  getNetworkShareStats,
} from '../lib/networkShareStats.ts'
import type { NetworkGraphEdge, NetworkGraphNode } from '../hooks/useNetworkGraph.ts'
import type { Bridge, User } from '../types/index.ts'

const user = (id: string, name: string): User => ({
  id,
  display_name: name,
  username: id,
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01T00:00:00.000Z',
})

const node = (
  id: string,
  name: string,
  bridgeCount: number,
  isSelf = false,
): NetworkGraphNode => ({
  id,
  user: user(id, name),
  isSelf,
  bridgeCount,
})

const bridgeEdge = (id: string, category: string): NetworkGraphEdge => ({
  id,
  source: 'viewer',
  target: 'friend',
  bridge: {
    id,
    gum_piece_id: id,
    user_a_id: 'viewer',
    user_b_id: 'friend',
    category,
    color_hex: '#000000',
    activity_title: 'Test',
    formed_at: '2026-01-01T00:00:00.000Z',
  } as Bridge,
})

describe('formatShareStatLine', () => {
  it('pluralizes people and bridges', () => {
    expect(formatShareStatLine(8, 12)).toBe('8 people · 12 bridges')
  })

  it('uses singular labels for counts of one', () => {
    expect(formatShareStatLine(1, 1)).toBe('1 person · 1 bridge')
  })

  it('handles empty network', () => {
    expect(formatShareStatLine(0, 0)).toBe('0 people · 0 bridges')
  })
})

describe('getFirstName', () => {
  it('returns the first token of a display name', () => {
    expect(getFirstName('Alex Kim')).toBe('Alex')
  })

  it('falls back when display name is blank', () => {
    expect(getFirstName('   ')).toBe('?')
  })
})

describe('getDominantBridgeCategoryColor', () => {
  it('returns accent color when there are no bridges', () => {
    expect(getDominantBridgeCategoryColor([])).toBe('#CF8EE8')
  })

  it('picks the majority category with constants order as tie-break', () => {
    const edges = [
      bridgeEdge('1', 'explore'),
      bridgeEdge('2', 'explore'),
      bridgeEdge('3', 'active'),
      bridgeEdge('4', 'active'),
      bridgeEdge('5', 'intimate'),
    ]

    expect(getDominantBridgeCategoryColor(edges)).toBe('#7DD47A')
  })
})

describe('getNetworkShareStats', () => {
  it('counts bridged people and total bridges', () => {
    const nodes = [
      node('viewer', 'You', 0, true),
      node('a', 'Alex Kim', 2),
      node('b', 'Sam Lee', 0),
      node('c', 'Jordan', 1),
    ]
    const edges = [bridgeEdge('1', 'intimate'), bridgeEdge('2', 'active'), bridgeEdge('3', 'active')]

    expect(getNetworkShareStats(nodes, edges)).toEqual({
      peopleCount: 2,
      bridgeCount: 3,
      glowColor: '#7DD47A',
    })
  })
})

describe('getExportLabelNodeIds', () => {
  it('returns up to five highest-bridge non-self nodes', () => {
    const nodes = [
      node('viewer', 'You', 0, true),
      node('a', 'Alex', 5),
      node('b', 'Sam', 3),
      node('c', 'Jordan', 1),
      node('d', 'Pat', 4),
      node('e', 'Quinn', 2),
      node('f', 'Riley', 6),
    ]

    expect(getExportLabelNodeIds(nodes)).toEqual(new Set(['f', 'a', 'd', 'b', 'e']))
  })
})
