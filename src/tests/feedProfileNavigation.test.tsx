/**
 * Tests for feed profile navigation — spec 015 (F-01, F-03)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockUseAuth = vi.fn()
const mockUseFeed = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../hooks/useAuth.ts', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useFeed.ts', () => ({
  useFeed: () => mockUseFeed(),
}))

vi.mock('../hooks/usePaginatedItems.ts', () => ({
  usePaginatedItems: (items: unknown[]) => ({
    visibleItems: items,
    hasMore: false,
    loadMore: vi.fn(),
  }),
}))

vi.mock('../hooks/useScrollRestore.ts', () => ({
  useScrollRestore: vi.fn(),
}))

vi.mock('../components/layout/Layout.tsx', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/feed/PostDetailSheet.tsx', () => ({
  PostDetailSheet: ({ postId }: { postId: string | null }) =>
    postId ? <div role="dialog" aria-label="Post detail open">{postId}</div> : null,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn() }),
    useQueryClient: () => ({ cancelQueries: vi.fn(), getQueryData: vi.fn(), setQueryData: vi.fn() }),
  }
})

vi.mock('../lib/supabase.ts', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import Feed from '../pages/Feed.tsx'

const viewerPost = {
  id: 'post-own',
  body: 'My own post',
  created_at: new Date().toISOString(),
  author: {
    id: 'user-1',
    display_name: 'Test User',
    username: 'testuser',
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
  },
  bridge: {
    id: 'bridge-1',
    category: 'explore',
    user_a_id: 'user-1',
    user_b_id: 'user-2',
  },
  otherParticipantName: 'Sam Friend',
  reactionCount: 0,
  commentCount: 0,
  hasReacted: false,
}

const friendPost = {
  ...viewerPost,
  id: 'post-friend',
  body: 'Friend post',
  author: {
    id: 'user-2',
    display_name: 'Sam Friend',
    username: 'samfriend',
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
  },
}

function renderFeed(initialEntry: { pathname: string; state?: Record<string, string> }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/feed" element={<Feed />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Feed profile navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseFeed.mockReturnValue({
      posts: [viewerPost, friendPost],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('does not navigate when tapping own post author row (F-01)', async () => {
    const user = userEvent.setup()
    renderFeed({ pathname: '/feed' })

    await user.click(screen.getByRole('button', { name: /Test User/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to other-user profile with returnTo feed (F-04)', async () => {
    const user = userEvent.setup()
    renderFeed({ pathname: '/feed' })

    const friendCard = screen.getByText('Friend post').closest('article')!
    await user.click(within(friendCard).getByText('@samfriend'))

    expect(mockNavigate).toHaveBeenCalledWith('/profile/samfriend', {
      state: { returnTo: '/feed' },
    })
  })

  it('reopens post detail when restorePostId is in location state (F-03)', () => {
    renderFeed({
      pathname: '/feed',
      state: { restorePostId: 'post-friend' },
    })

    expect(screen.getByRole('dialog', { name: 'Post detail open' })).toHaveTextContent(
      'post-friend',
    )
    expect(mockNavigate).toHaveBeenCalledWith('.', { replace: true, state: {} })
  })
})
