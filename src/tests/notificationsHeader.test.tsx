/**
 * Tests for mark-all-read icon button on src/pages/Notifications.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const mockUseAuth = vi.fn()
const mockUseNotifications = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useNotifications.ts', () => ({
  useNotifications: () => mockUseNotifications(),
}))

vi.mock('../hooks/useScrollRestore.ts', () => ({
  useScrollRestore: vi.fn(),
}))

vi.mock('../components/connections/ConnectionRequestSheet.tsx', () => ({
  ConnectionRequestSheet: () => null,
}))

import Notifications from '../pages/Notifications.tsx'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('Notifications header mark-all control', () => {
  let queryClient: QueryClient
  const markAllAsRead = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAllAsRead,
      dismissNotification: vi.fn(),
      loading: false,
      error: null,
    })
  })

  it('shows mark-all icon button when unread notifications exist', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 3,
      markAsRead: vi.fn(),
      markAllAsRead,
      dismissNotification: vi.fn(),
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>,
      { wrapper: makeWrapper(queryClient) },
    )

    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument()
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument()
  })

  it('hides mark-all control when there are no unread notifications', () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>,
      { wrapper: makeWrapper(queryClient) },
    )

    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument()
  })

  it('calls markAllAsRead when the icon button is clicked', async () => {
    const user = userEvent.setup()
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 2,
      markAsRead: vi.fn(),
      markAllAsRead,
      dismissNotification: vi.fn(),
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>,
      { wrapper: makeWrapper(queryClient) },
    )

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(markAllAsRead).toHaveBeenCalledTimes(1)
  })
})
