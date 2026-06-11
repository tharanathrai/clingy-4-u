/**
 * Tests for RouteErrorBoundary recovery behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouteErrorBoundary } from '../components/layout/RouteErrorBoundary.tsx'

const mockUseAuth = vi.fn()
const mockUseProfileReady = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useProfileReady.ts', () => ({
  useProfileReady: () => mockUseProfileReady(),
}))

function BrokenPage(): never {
  throw new Error('boom')
}

function LocationProbe() {
  const location = useLocation()
  return <p>Current path: {location.pathname}</p>
}

function renderWithRouter(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/crash" element={<BrokenPage />} />
            <Route path="/welcome" element={<LocationProbe />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseProfileReady.mockReturnValue({
      profileReady: false,
      isLoading: false,
    })
  })

  it('shows recovery UI when a route throws', () => {
    renderWithRouter('/crash')

    expect(screen.getByRole('heading', { name: 'Something broke.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('keeps recovery actions available after Try again on a persistently broken route', async () => {
    const user = userEvent.setup()

    renderWithRouter('/crash')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('heading', { name: 'Something broke.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('navigates unonboarded users to /welcome from Go home', async () => {
    const user = userEvent.setup()

    renderWithRouter('/crash')

    await user.click(screen.getByRole('button', { name: 'Go home' }))

    expect(screen.getByText('Current path: /welcome')).toBeInTheDocument()
  })
})
