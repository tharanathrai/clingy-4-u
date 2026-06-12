/**
 * Tests for GraphShareButton save/share flows (spec 016)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraphShareButton } from '../components/network/GraphShareButton.tsx'

const buildSocialShareSnapshot = vi.fn()
const canShareGraphFiles = vi.fn()

const shareCardOptions = {
  peopleCount: 2,
  bridgeCount: 3,
  glowColor: '#CF8EE8',
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

  it('downloads an image when canvas ref is ready and nothing is selected', async () => {
    const user = userEvent.setup()
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const graphRef = createRef<HTMLCanvasElement>()
    graphRef.current = canvas

    buildSocialShareSnapshot.mockResolvedValue({
      blob: new Blob(['png'], { type: 'image/png' }),
      dataUrl: 'data:image/png;base64,abc',
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <GraphShareButton
        graphRef={graphRef}
        prepareForSnapshot={async () => () => {}}
        shareCardOptions={shareCardOptions}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    await waitFor(() => {
      expect(buildSocialShareSnapshot).toHaveBeenCalledWith(canvas, shareCardOptions)
    })
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it('shows an error toast when snapshot capture fails', async () => {
    const user = userEvent.setup()
    const canvas = document.createElement('canvas')
    const graphRef = createRef<HTMLCanvasElement>()
    graphRef.current = canvas

    buildSocialShareSnapshot.mockResolvedValue(null)

    render(
      <GraphShareButton
        graphRef={graphRef}
        prepareForSnapshot={async () => () => {}}
        shareCardOptions={shareCardOptions}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    expect(
      await screen.findByText("Couldn't save image — try again"),
    ).toBeInTheDocument()
  })

  it('shows an error toast when canvas ref is missing', async () => {
    const user = userEvent.setup()
    const graphRef = createRef<HTMLCanvasElement>()

    render(<GraphShareButton graphRef={graphRef} shareCardOptions={shareCardOptions} />)

    await user.click(screen.getByRole('button', { name: 'Share network graph' }))
    await user.click(screen.getByRole('menuitem', { name: 'Save image' }))

    expect(
      await screen.findByText("Couldn't save image — try again"),
    ).toBeInTheDocument()
    expect(buildSocialShareSnapshot).not.toHaveBeenCalled()
  })
})
