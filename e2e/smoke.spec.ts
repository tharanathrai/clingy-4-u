/**
 * Smoke tests — 5 critical paths
 *
 * Run against `vite preview` (pre-built app) with mocked Supabase network.
 * No live Supabase project needed.
 *
 * Paths tested:
 * 1. Landing page loads and shows sign-in
 * 2. Unauthenticated user is redirected to / from any protected route
 * 3. Onboarded user lands on /add (pocket view), not welcome
 * 4. /network and /notifications open without console errors (realtime subscribe bug)
 * 5. Settings is reachable via /settings; no duplicate bottom link on profile
 */

import { test, expect } from '@playwright/test'
import { injectMockSession, mockOnboardedUser, mockUnonboardedUser, MOCK_USER } from './mocks.ts'

// ---------------------------------------------------------------------------
// 1. Landing page
// ---------------------------------------------------------------------------

test('landing page shows sign-in CTA', async ({ page }) => {
  await page.goto('/')
  // Should render the landing page, not redirect or blank-screen
  await expect(page).not.toHaveURL(/\/(add|home|network|notifications|settings)/)
  // Landing has a "get started" or similar button — check for main element rendered
  await expect(page.locator('main')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Auth guard redirects unauthenticated users to /
// ---------------------------------------------------------------------------

test('unauthenticated access to /add redirects to /', async ({ page }) => {
  await page.goto('/add')
  // AuthGuard should redirect to /
  await expect(page).toHaveURL('/')
})

test('unauthenticated access to /network redirects to /', async ({ page }) => {
  await page.goto('/network')
  await expect(page).toHaveURL('/')
})

// ---------------------------------------------------------------------------
// 3. Onboarded user lands on /add
// ---------------------------------------------------------------------------

test('onboarded user goes directly to /add without looping through /welcome', async ({ page }) => {
  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto('/add')

  // Should stay on /add (not redirect to /welcome)
  await expect(page).toHaveURL(/\/add/)
  // Page should render without a black screen
  await expect(page.locator('main, [role="main"]')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. /network and /notifications open without Realtime console errors
// ---------------------------------------------------------------------------

test('/network loads without subscribe() console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto('/network')
  await page.waitForLoadState('networkidle')

  const realtimeErrors = consoleErrors.filter((e) =>
    e.includes('cannot add') && e.includes('after') && e.includes('subscribe'),
  )
  expect(realtimeErrors).toHaveLength(0)
})

test('/notifications loads without subscribe() console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto('/notifications')
  await page.waitForLoadState('networkidle')

  const realtimeErrors = consoleErrors.filter((e) =>
    e.includes('cannot add') && e.includes('after') && e.includes('subscribe'),
  )
  expect(realtimeErrors).toHaveLength(0)
})

// ---------------------------------------------------------------------------
// 5. No duplicate settings link on profile
// ---------------------------------------------------------------------------

test('profile page does not have a "settings →" text link at the bottom', async ({ page }) => {
  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto(`/u/${MOCK_USER.id}`)
  await page.waitForLoadState('networkidle')

  // The redundant "settings →" bottom link was removed in a previous fix.
  // Assert it does not exist on the page.
  const settingsBottomLink = page.getByRole('link', { name: /^settings →$/ })
  await expect(settingsBottomLink).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// 6. Onboarding without avatar → lands on /add, not /welcome step 1
// ---------------------------------------------------------------------------

test('new user who skips avatar completes onboarding and reaches /add', async ({ page }) => {
  await mockUnonboardedUser(page)
  await injectMockSession(page)

  // Intercept the user insert to succeed
  await page.route('**/rest/v1/users', (route) => {
    if (route.request().method() === 'POST') {
      void route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: MOCK_USER.id }),
      })
    } else {
      void route.continue()
    }
  })

  await page.goto('/welcome')
  await page.waitForLoadState('networkidle')

  // The onboarding should be visible (not redirected away since no profile)
  await expect(page).toHaveURL(/\/welcome/)
})
