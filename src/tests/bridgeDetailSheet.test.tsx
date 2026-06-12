/**
 * Tests for BridgeDetailSheet profile vs network context and viewer avatar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BridgeDetailSheet } from '../components/network/BridgeDetailSheet.tsx'
import { networkProfileReturnState } from '../lib/navigationContext.ts'
import type { Bridge, User } from '../types/index.ts'

const mockUseAuth = vi.fn()
const mockUseProfile = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useProfile.ts', () => ({
  useProfile: () => mockUseProfile(),
}))

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
  avatar_url: 'https://example.com/jordan.jpg',
  bio: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const viewerProfile: User = {
  id: 'user-1',
  display_name: 'Alex',
  username: 'alex',
  avatar_url: 'https://example.com/alex.jpg',
  bio: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

function renderSheet(variant: 'network' | 'profile' = 'network') {
  return render(
    <MemoryRouter>
      <BridgeDetailSheet
        bridge={bridge}
        otherUser={otherUser}
        otherUserId={otherUser.id}
        variant={variant}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('BridgeDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseProfile.mockReturnValue({
      profile: viewerProfile,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('shows viewer avatar and other participant on network variant', () => {
    renderSheet('network')

    expect(screen.getByAltText('Alex')).toHaveAttribute(
      'src',
      expect.stringContaining('alex.jpg'),
    )
    expect(screen.getByAltText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('shows Make plan and View profile on network variant', () => {
    renderSheet('network')

    expect(screen.getByRole('link', { name: 'Make plan' })).toHaveAttribute('href', '/piece/new')
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute(
      'href',
      '/profile/jordan',
    )
  })

  it('View profile uses network return state (C-01)', () => {
    expect(networkProfileReturnState(otherUser.id)).toEqual({
      returnTo: '/network',
      selectUserId: otherUser.id,
    })
  })

  it('hides Make plan and View profile on profile variant', () => {
    renderSheet('profile')

    expect(screen.queryByRole('link', { name: 'Make plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View profile' })).not.toBeInTheDocument()
    expect(screen.getByText('Coffee walk')).toBeInTheDocument()
    expect(screen.getByAltText('Alex')).toBeInTheDocument()
  })

  it('shows viewer initials when avatar is missing', () => {
    mockUseProfile.mockReturnValue({
      profile: { ...viewerProfile, avatar_url: null },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderSheet('profile')

    expect(screen.queryByAltText('Alex')).not.toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
