/**
 * Shared Supabase mock helpers for Playwright smoke tests.
 *
 * All tests intercept Supabase REST API calls so they run without a live
 * project. Auth state is injected via localStorage to bypass the OAuth flow.
 */

import type { Page } from '@playwright/test'

const SUPABASE_URL = 'https://placeholder.supabase.co'

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

/**
 * Inject a mock Supabase session into localStorage so the app treats the
 * user as authenticated without going through Google OAuth.
 */
export async function injectMockSession(page: Page): Promise<void> {
  await page.addInitScript((userId) => {
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
    // Supabase stores the session under this key
    localStorage.setItem(
      `sb-placeholder-auth-token`,
      JSON.stringify(session),
    )
  }, MOCK_USER.id)
}

/**
 * Mock the Supabase /auth/v1/user endpoint used by getUser()
 */
export async function mockAuthUser(page: Page): Promise<void> {
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
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
  await page.route(`${SUPABASE_URL}/rest/v1/users*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PROFILE]),
    })
  })

  // Gum pieces
  await page.route(`${SUPABASE_URL}/rest/v1/gum_pieces*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Connections
  await page.route(`${SUPABASE_URL}/rest/v1/connections*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Notifications
  await page.route(`${SUPABASE_URL}/rest/v1/notifications*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Bridges
  await page.route(`${SUPABASE_URL}/rest/v1/bridges*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Realtime websocket (block gracefully)
  await page.route(`${SUPABASE_URL}/realtime/**`, (route) => {
    void route.abort()
  })
}

/**
 * Mock validate-qr-token edge function to succeed with a connection request.
 */
export async function mockValidateQrTokenSuccess(page: Page): Promise<void> {
  await page.route(`${SUPABASE_URL}/functions/v1/validate-qr-token`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    const body = (route.request().postDataJSON() ?? {}) as { preview?: boolean }

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
  await page.route(`${SUPABASE_URL}/functions/v1/respond-connection`, (route) => {
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

  await page.route(`${SUPABASE_URL}/rest/v1/notifications*`, async (route) => {
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

  await page.route(`${SUPABASE_URL}/rest/v1/connections*`, async (route) => {
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

  await page.route(`${SUPABASE_URL}/rest/v1/users*`, async (route) => {
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
 * Mock generate-qr-token edge function for the /add screen.
 */
export async function mockGenerateQrToken(page: Page): Promise<void> {
  await page.route(`${SUPABASE_URL}/functions/v1/generate-qr-token`, (route) => {
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

  await page.route(`${SUPABASE_URL}/rest/v1/users*`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(`${SUPABASE_URL}/realtime/**`, (route) => {
    void route.abort()
  })
}
