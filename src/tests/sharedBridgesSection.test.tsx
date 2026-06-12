/**
 * Tests for SharedBridgesSection navigation context (spec 014 C-02)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SharedBridgesSection } from '../components/profile/SharedBridgesSection.tsx'
import type { User } from '../types/index.ts'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const otherUser: User = {
  id: 'user-2',
  display_name: 'Jordan',
  username: 'jordan',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('SharedBridgesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes profile returnTo when starting new gum from empty state (C-02)', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <SharedBridgesSection bridges={[]} otherUser={otherUser} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'New gum' }))

    expect(mockNavigate).toHaveBeenCalledWith('/piece/new', {
      state: {
        recipientId: 'user-2',
        returnTo: '/profile/jordan',
      },
    })
  })
})
