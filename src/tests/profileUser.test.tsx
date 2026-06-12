/**
 * Tests for src/pages/ProfileUser.tsx back navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()
const mockUseProfile = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useProfile.ts', () => ({
  useProfile: () => mockUseProfile(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import ProfileUser from '../pages/ProfileUser.tsx'

function renderProfile(initialEntries: string[] = ['/profile/jordan']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ProfileUser />
    </MemoryRouter>,
  )
}

const otherUserProfile = {
  id: 'user-2',
  display_name: 'Jordan',
  username: 'jordan',
  bio: 'Explorer',
  avatar_url: null,
}

const defaultProfileState = {
  profile: otherUserProfile,
  connectionCount: 1,
  categoryBreakdown: {
    intimate: 0,
    active: 0,
    playful: 0,
    explore: 1,
    recharge: 0,
    savor: 0,
    support: 0,
  },
  bridgeCount: 1,
  sharedBridges: [],
  isConnected: true,
  loading: false,
  error: null,
  refetch: vi.fn(),
}

describe('ProfileUser back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseProfile.mockReturnValue(defaultProfileState)
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 2 },
    })
  })

  it('shows back header when viewing another user profile', () => {
    renderProfile()

    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument()
    expect(screen.getByText('Jordan')).toBeInTheDocument()
  })

  it('shows back header while loading', () => {
    mockUseProfile.mockReturnValue({
      ...defaultProfileState,
      profile: null,
      loading: true,
    })

    renderProfile()

    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument()
  })

  it('shows back header on profile not found', () => {
    mockUseProfile.mockReturnValue({
      ...defaultProfileState,
      profile: null,
      loading: false,
      error: null,
    })

    renderProfile()

    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument()
    expect(screen.getByText('Profile not found.')).toBeInTheDocument()
  })

  it('navigates back via history when no returnTo state is present', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'back' }))

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('navigates to returnTo with selectUserId when provided in location state', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/profile/jordan',
            state: { returnTo: '/network', selectUserId: 'user-2' },
          },
        ]}
      >
        <ProfileUser />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'back' }))

    expect(mockNavigate).toHaveBeenCalledWith('/network', {
      state: { selectUserId: 'user-2' },
    })
  })

  it('falls back to home when history has no prior entry', async () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 },
    })
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'back' }))

    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })
})
