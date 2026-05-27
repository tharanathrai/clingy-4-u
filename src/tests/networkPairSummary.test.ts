import { describe, expect, it } from 'vitest'
import { getMajorityBridgeColor, getPairLinkDistance } from '../lib/networkPairSummary.ts'
import type { Bridge } from '../types/index.ts'

const bridge = (category: string, color_hex: string): Bridge => ({
  id: `b-${category}-${color_hex}`,
  gum_piece_id: 'gp-1',
  user_a_id: 'a',
  user_b_id: 'b',
  category,
  color_hex,
  activity_title: 'Test',
  formed_at: '2026-01-01T00:00:00Z',
})

describe('getPairLinkDistance', () => {
  it('returns shorter distance for more bridges', () => {
    expect(getPairLinkDistance(5)).toBeLessThan(getPairLinkDistance(1))
  })

  it('clamps at minimum distance', () => {
    expect(getPairLinkDistance(20)).toBe(56)
  })
})

describe('getMajorityBridgeColor', () => {
  it('picks the category with the highest bridge count', () => {
    const bridges = [
      bridge('active', '#7DD47A'),
      bridge('active', '#7DD47A'),
      bridge('playful', '#F07868'),
    ]
    expect(getMajorityBridgeColor(bridges)).toBe('#7DD47A')
  })

  it('breaks ties using stable category order', () => {
    const bridges = [bridge('playful', '#F07868'), bridge('active', '#7DD47A')]
    expect(getMajorityBridgeColor(bridges)).toBe('#7DD47A')
  })

  it('falls back to first bridge color when categories are unknown', () => {
    const bridges = [bridge('unknown-cat', '#ABCDEF')]
    expect(getMajorityBridgeColor(bridges)).toBe('#ABCDEF')
  })
})
