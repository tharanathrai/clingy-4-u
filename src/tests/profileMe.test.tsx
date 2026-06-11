/**
 * Tests for src/pages/ProfileMe.tsx graveyard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const mockUseAuth = vi.fn()
const mockUseProfile = vi.fn()
const mockInvoke = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useProfile.ts', () => ({
  useProfile: () => mockUseProfile(),
}))

vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}))

import ProfileMe from '../pages/ProfileMe.tsx'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('ProfileMe graveyard navigation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    mockInvoke.mockResolvedValue({ data: null, error: null })
  })

  it('shows graveyard in the header and removes the bottom text link', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseProfile.mockReturnValue({
      profile: {
        id: 'user-1',
        display_name: 'Alex',
        username: 'alex',
        bio: 'Bridge builder',
        avatar_url: null,
      },
      connectionCount: 2,
      categoryBreakdown: {
        intimate: 0,
        active: 0,
        playful: 0,
        explore: 0,
        recharge: 0,
        savor: 0,
        support: 0,
      },
      bridgeCount: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ProfileMe />
      </MemoryRouter>,
      { wrapper: makeWrapper(queryClient) },
    )

    expect(screen.getByRole('link', { name: 'Graveyard' })).toHaveAttribute('href', '/home/graveyard')
    expect(screen.queryByRole('link', { name: /graveyard →/i })).not.toBeInTheDocument()
    expect(screen.queryByText('graveyard →')).not.toBeInTheDocument()
  })
})
