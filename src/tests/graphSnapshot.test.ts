/**
 * Tests for graph snapshot export (spec 016)
 */

import { describe, expect, it } from 'vitest'
import { getGraphSnapshotFileName } from '../lib/graphSnapshot.ts'

describe('getGraphSnapshotFileName', () => {
  it('uses my-bridges prefix and date segments', () => {
    expect(getGraphSnapshotFileName()).toMatch(/^my-bridges-\d{4}-\d{2}-\d{2}\.png$/)
  })
})
