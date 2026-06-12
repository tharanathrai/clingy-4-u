/**
 * Tests for prepareGraphSnapshotCapture noop and restore paths (spec 016)
 */

import { describe, expect, it, vi } from 'vitest'
import { prepareGraphSnapshotCapture } from '../lib/networkSnapshotPrep.ts'
import type { Bridge, User } from '../types/index.ts'

const bridge: Bridge = {
  id: 'bridge-1',
  user_a_id: 'user-1',
  user_b_id: 'user-2',
  activity_title: 'Coffee walk',
  category: 'explore',
  color_hex: '#6DB8F0',
  formed_at: '2026-03-10T12:00:00.000Z',
  gum_piece_id: 'piece-1',
}

const otherUser: User = {
  id: 'user-2',
  display_name: 'Jordan',
  username: 'jordan',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('prepareGraphSnapshotCapture', () => {
  it('returns a no-op restore when nothing is selected', async () => {
    const clearSelection = vi.fn()
    const restoreSelection = vi.fn()
    const waitForPaint = vi.fn(async () => {})

    const restore = await prepareGraphSnapshotCapture(
      {
        selectedUserId: null,
        selectedBridge: null,
        selectedUser: null,
      },
      { clearSelection, restoreSelection, waitForPaint },
    )

    expect(clearSelection).not.toHaveBeenCalled()
    expect(waitForPaint).not.toHaveBeenCalled()
    restore()
    expect(restoreSelection).not.toHaveBeenCalled()
  })

  it('clears selection before capture and restores afterward', async () => {
    const clearSelection = vi.fn()
    const restoreSelection = vi.fn()
    const waitForPaint = vi.fn(async () => {})

    const restore = await prepareGraphSnapshotCapture(
      {
        selectedUserId: otherUser.id,
        selectedBridge: bridge,
        selectedUser: otherUser,
      },
      { clearSelection, restoreSelection, waitForPaint },
    )

    expect(clearSelection).toHaveBeenCalledTimes(1)
    expect(waitForPaint).toHaveBeenCalledTimes(1)

    restore()

    expect(restoreSelection).toHaveBeenCalledWith({
      selectedUserId: otherUser.id,
      selectedBridge: bridge,
      selectedUser: otherUser,
    })
  })
})
