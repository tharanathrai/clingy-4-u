/**
 * Shared Supabase mock helpers for Playwright smoke tests.
 *
 * All tests intercept Supabase REST API calls so they run without a live
 * project. Auth state is injected via localStorage to bypass the OAuth flow.
 */

import type { Page } from '@playwright/test'

/** Must match the app build used by Playwright (see playwright.config.ts webServer). */
export const E2E_SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'

function supabaseAuthStorageKey(url: string): string {
  try {
    const ref = new URL(url).hostname.split('.')[0] ?? 'placeholder'
    return `sb-${ref}-auth-token`
  } catch {
    return 'sb-placeholder-auth-token'
  }
}

const wantsSingleObject = (headers: Record<string, string>): boolean =>
  headers.accept?.includes('application/vnd.pgrst.object+json') === true

export const MOCK_USER = {
  id: 'mock-user-id',
  email: 'test@example.com',
}

export const MOCK_PROFILE = {
  id: 'mock-user-id',
  display_name: 'Test User',
  username: 'testuser',
  avatar_url: null,
  bio: null,
  created_at: new Date().toISOString(),
}

export const MOCK_SCANNED_USER = {
  display_name: 'Scanned Friend',
  username: 'scannedfriend',
  avatar_url: null,
}

export const MOCK_REQUESTER_ID = 'mock-requester-id'
export const MOCK_CONNECTION_ID = 'mock-connection-id'

const sortedMockUserIds = [MOCK_USER.id, 'mock-friend-id'].sort()

export const MOCK_FRIEND = {
  id: 'mock-friend-id',
  display_name: 'Sam Friend',
  username: 'samfriend',
  avatar_url: null,
  bio: 'Bridge buddy',
  created_at: new Date().toISOString(),
}

export const MOCK_ACTIVE_CONNECTION = {
  id: 'mock-active-connection-id',
  user_a_id: sortedMockUserIds[0],
  user_b_id: sortedMockUserIds[1],
  status: 'active',
  requested_by: MOCK_FRIEND.id,
  created_at: new Date().toISOString(),
  accepted_at: new Date().toISOString(),
}

export const MOCK_BRIDGE = {
  id: 'mock-bridge-id',
  gum_piece_id: 'mock-piece-id',
  user_a_id: sortedMockUserIds[0],
  user_b_id: sortedMockUserIds[1],
  category: 'explore',
  color_hex: '#4A90D9',
  activity_title: 'Coffee walk',
  formed_at: new Date().toISOString(),
}

export const MOCK_FEED_POST = {
  id: 'mock-post-id',
  bridge_id: MOCK_BRIDGE.id,
  author_id: MOCK_FRIEND.id,
  body: 'Great coffee walk today!',
  is_public: true,
  created_at: new Date().toISOString(),
}

/**
 * Inject a mock Supabase session into localStorage so the app treats the
 * user as authenticated without going through Google OAuth.
 */
export async function injectMockSession(page: Page): Promise<void> {
  await page.addInitScript(({ userId, authStorageKey }) => {
    const session = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: userId,
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
      },
    }
    localStorage.setItem(authStorageKey, JSON.stringify(session))
  }, { userId: MOCK_USER.id, authStorageKey: supabaseAuthStorageKey(E2E_SUPABASE_URL) })
}

/**
 * Mock the Supabase /auth/v1/user endpoint used by getUser()
 */
export async function mockAuthUser(page: Page): Promise<void> {
  await page.route(`${E2E_SUPABASE_URL}/auth/v1/user`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        role: 'authenticated',
        aud: 'authenticated',
        user_metadata: {},
      }),
    })
  })
}

/**
 * Mock Supabase REST endpoints for a user who has completed onboarding
 * (profile row exists).
 */
export async function mockOnboardedUser(page: Page): Promise<void> {
  await mockAuthUser(page)

  // Profile check (users table)
  await page.route(`${E2E_SUPABASE_URL}/rest/v1/users*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PROFILE]),
    })
  })

  // Gum pieces
  await page.route(`${E2E_SUPABASE_URL}/rest/v1/gum_pieces*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Connections
  await page.route(`${E2E_SUPABASE_URL}/rest/v1/connections*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Notifications
  await page.route(`${E2E_SUPABASE_URL}/rest/v1/notifications*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Bridges
  await page.route(`${E2E_SUPABASE_URL}/rest/v1/bridges*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Realtime websocket (block gracefully)
  await page.route(`${E2E_SUPABASE_URL}/realtime/**`, (route) => {
    void route.abort()
  })
}

/**
 * Mock validate-qr-token edge function to succeed with a connection request.
 */
export async function mockValidateQrTokenSuccess(page: Page): Promise<void> {
  await page.route(`${E2E_SUPABASE_URL}/functions/v1/validate-qr-token`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    const body = (route.request().postDataJSON() ?? {}) as { preview?: boolean }

    const token = (body as { token?: string }).token ?? ''

    if (token === 'invalid-random-token') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'This is not a Clingy connection code.',
          error_code: 'invalid_token',
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: MOCK_SCANNED_USER,
        preview: body.preview === true,
        ...(body.preview ? {} : { connection_id: 'mock-connection-id' }),
      }),
    })
  })
}

/**
 * Mock respond-connection edge function.
 */
export async function mockRespondConnection(
  page: Page,
  action: 'accept' | 'reject' = 'accept',
): Promise<void> {
  await page.route(`${E2E_SUPABASE_URL}/functions/v1/respond-connection`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        action,
        connection_id: MOCK_CONNECTION_ID,
        other_user_id: MOCK_REQUESTER_ID,
      }),
    })
  })
}

/**
 * Adds a pending connection request notification and related rows.
 * Call after mockOnboardedUser — overrides notifications/connections/users routes.
 */
export async function mockPendingConnectionRequest(page: Page): Promise<void> {
  const sortedIds = [MOCK_USER.id, MOCK_REQUESTER_ID].sort()
  const pendingConnection = {
    id: MOCK_CONNECTION_ID,
    user_a_id: sortedIds[0],
    user_b_id: sortedIds[1],
    requested_by: MOCK_REQUESTER_ID,
    status: 'pending',
  }

  const notification = {
    id: 'mock-notification-id',
    user_id: MOCK_USER.id,
    type: 'connection_request',
    reference_id: MOCK_CONNECTION_ID,
    read: false,
    created_at: new Date().toISOString(),
  }

  const requesterProfile = {
    id: MOCK_REQUESTER_ID,
    display_name: 'Sam Friend',
    username: 'samfriend',
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
  }

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/notifications*`, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([notification]),
      })
      return
    }
    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...notification, read: true }),
      })
      return
    }
    await route.continue()
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/connections*`, async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'GET') {
      if (url.includes(MOCK_CONNECTION_ID)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            url.includes('id=in.') ? [pendingConnection] : pendingConnection,
          ),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }
    await route.continue()
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/users*`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    const url = route.request().url()
    if (url.includes(MOCK_REQUESTER_ID)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([requesterProfile]),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PROFILE]),
    })
  })
}

/**
 * Mock an onboarded user with one active connection, bridge, and a friend feed post.
 * Used by profile back-navigation E2E tests.
 */
export async function mockConnectedFriendScenario(page: Page): Promise<void> {
  await mockAuthUser(page)

  const allUsers = [MOCK_PROFILE, MOCK_FRIEND]

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/users*`, async (route) => {
    const method = route.request().method()
    if (method !== 'GET') {
      await route.continue()
      return
    }

    const url = route.request().url()
    const single = wantsSingleObject(route.request().headers())
    const asPayload = <T>(value: T | T[]) => JSON.stringify(single ? (Array.isArray(value) ? value[0] : value) : value)

    if (url.includes(`username=eq.${MOCK_FRIEND.username}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: asPayload(MOCK_FRIEND),
      })
      return
    }
    if (url.includes(MOCK_FRIEND.id)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: asPayload(url.includes('id=in.') ? [MOCK_FRIEND] : MOCK_FRIEND),
      })
      return
    }
    if (url.includes(MOCK_USER.id)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: asPayload(url.includes('id=in.') ? [MOCK_PROFILE] : MOCK_PROFILE),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(allUsers),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/connections*`, async (route) => {
    const method = route.request().method()
    if (method !== 'GET') {
      await route.continue()
      return
    }

    const url = route.request().url()
    if (url.includes('status=eq.pending')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    const single = wantsSingleObject(route.request().headers())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(single ? MOCK_ACTIVE_CONNECTION : [MOCK_ACTIVE_CONNECTION]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/bridges*`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_BRIDGE]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/posts*`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }

    const url = route.request().url()
    if (url.includes(`author_id=eq.${MOCK_USER.id}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_FEED_POST]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/reactions*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/comments*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/gum_pieces*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/notifications*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/realtime/**`, (route) => {
    void route.abort()
  })
}

/**
 * Restore network node selection via React Router history state after page load.
 */
export async function restoreNetworkNodeSelection(page: Page, userId: string): Promise<void> {
  await page.evaluate((selectUserId) => {
    window.history.replaceState(
      { usr: { selectUserId }, idx: 0, key: 'e2e-network-restore' },
      '',
      '/network',
    )
  }, userId)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/**
 * Mock generate-qr-token edge function for the /add screen.
 */
export async function mockGenerateQrToken(page: Page): Promise<void> {
  await page.route(`${E2E_SUPABASE_URL}/functions/v1/generate-qr-token`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-qr-token',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    })
  })
}

/**
 * Mock a user who is NOT yet onboarded (no profile row).
 */
export async function mockUnonboardedUser(page: Page): Promise<void> {
  await mockAuthUser(page)

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/users*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${E2E_SUPABASE_URL}/realtime/**`, (route) => {
    void route.abort()
  })
}
