/**
 * Tests for src/lib/feedParticipants.ts
 *
 * The other side of a feed post's bridge is often someone the viewer has no
 * relationship with, so their row is no longer readable and the name arrives
 * from the get_bridge_participant_names RPC instead. These pin the a/b
 * selection and the fallback, because getting the side wrong would label a
 * card with the author's own name.
 */

import { describe, it, expect } from 'vitest'
import {
  UNKNOWN_PARTICIPANT_NAME,
  indexParticipantNames,
  pickCounterpartName,
  type BridgeParticipantNames,
} from '../lib/feedParticipants.ts'

const AUTHOR = 'aaaaaaaa-0000-0000-0000-000000000001'
const OTHER = 'bbbbbbbb-0000-0000-0000-000000000002'

const names = (overrides: Partial<BridgeParticipantNames> = {}): BridgeParticipantNames => ({
  bridge_id: 'bridge-1',
  user_a_name: 'Ada',
  user_b_name: 'Blair',
  ...overrides,
})

describe('pickCounterpartName', () => {
  it('returns the b-side name when the author is the a-side', () => {
    const bridge = { user_a_id: AUTHOR, user_b_id: OTHER }
    expect(pickCounterpartName(bridge, AUTHOR, names())).toBe('Blair')
  })

  it('returns the a-side name when the author is the b-side', () => {
    const bridge = { user_a_id: OTHER, user_b_id: AUTHOR }
    expect(pickCounterpartName(bridge, AUTHOR, names())).toBe('Ada')
  })

  it('falls back when the rpc returned nothing for this bridge', () => {
    const bridge = { user_a_id: AUTHOR, user_b_id: OTHER }
    expect(pickCounterpartName(bridge, AUTHOR, undefined)).toBe(UNKNOWN_PARTICIPANT_NAME)
    expect(pickCounterpartName(bridge, AUTHOR, null)).toBe(UNKNOWN_PARTICIPANT_NAME)
  })

  it('falls back on an empty or whitespace name rather than rendering a blank', () => {
    const bridge = { user_a_id: AUTHOR, user_b_id: OTHER }
    expect(pickCounterpartName(bridge, AUTHOR, names({ user_b_name: '' }))).toBe(
      UNKNOWN_PARTICIPANT_NAME,
    )
    expect(pickCounterpartName(bridge, AUTHOR, names({ user_b_name: '   ' }))).toBe(
      UNKNOWN_PARTICIPANT_NAME,
    )
  })

  it('never returns the author’s own side', () => {
    const bridge = { user_a_id: AUTHOR, user_b_id: OTHER }
    expect(pickCounterpartName(bridge, AUTHOR, names())).not.toBe('Ada')
  })
})

describe('indexParticipantNames', () => {
  it('indexes rows by bridge id', () => {
    const rows = [names({ bridge_id: 'b1' }), names({ bridge_id: 'b2', user_a_name: 'Cy' })]
    const map = indexParticipantNames(rows)
    expect(map.size).toBe(2)
    expect(map.get('b2')?.user_a_name).toBe('Cy')
  })

  it('handles null and empty input', () => {
    expect(indexParticipantNames(null).size).toBe(0)
    expect(indexParticipantNames(undefined).size).toBe(0)
    expect(indexParticipantNames([]).size).toBe(0)
  })
})
