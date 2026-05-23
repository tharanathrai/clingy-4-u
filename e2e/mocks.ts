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
