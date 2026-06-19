/**
 * Tests for GraphShareButton save/share flows (spec 016)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraphShareButton } from '../components/network/GraphShareButton.tsx'
import type { SocialShareCardOptions } from '../lib/socialShareCard.ts'

const buildSocialShareSnapshot = vi.fn()
const canShareGraphFiles = vi.fn()

const shareCardOptions: SocialShareCardOptions = {
  userName: 'Robin',
  userAvatarUrl: null,
  date: 'June 2026',
  peopleCount: 2,
  bridgeCount: 3,
  topCat: 'active',
  people: [
    { name: 'Sam', avatarUrl: null, topCat: 'recharge', sharedCount: 2 },
    { name: 'Mara', avatarUrl: null, topCat: 'playful', sharedCount: 1 },
  ],
}

vi.mock('../lib/graphSnapshot.ts', () => ({
  buildSocialShareSnapshot: (...args: unknown[]) => buildSocialShareSnapshot(...args),
  canShareGraphFiles: () => canShareGraphFiles(),
  getGraphSnapshotFileName: () => 'my-bridges-2026-06-12.png',
}))

describe('GraphShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canShareGraphFiles.mockReturnValue(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('downloads an image when snapshot succeeds', async () => {
    const user = userEvent.setup()

    buildSocialShareSnapshot.mockResolvedValue({
      blob: new Blob(['png'], { type: 'image/png' }),
      dataUrl: 'data:image/png;base64,abc',
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<GraphShareButton shareCardOptions={shareCardOptions} />)

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    await waitFor(() => {
      expect(buildSocialShareSnapshot).toHaveBeenCalledWith(shareCardOptions)
    })
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it('shows an error toast when snapshot capture fails', async () => {
    const user = userEvent.setup()

    buildSocialShareSnapshot.mockResolvedValue(null)

    render(<GraphShareButton shareCardOptions={shareCardOptions} />)

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    expect(await screen.findByText("Couldn't save image — try again")).toBeInTheDocument()
  })

  it('shows an error toast when snapshot build throws', async () => {
    const user = userEvent.setup()

    buildSocialShareSnapshot.mockRejectedValue(new Error('canvas error'))

    render(<GraphShareButton shareCardOptions={shareCardOptions} />)

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    expect(await screen.findByText("Couldn't save image — try again")).toBeInTheDocument()
    expect(buildSocialShareSnapshot).toHaveBeenCalledWith(shareCardOptions)
  })
})
