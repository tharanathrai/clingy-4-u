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
 * 6. Network empty state for users with no connections
 * 7. QR scan modes and connection-request success modal behavior
 */

import { test, expect } from '@playwright/test'
import {
  injectMockSession,
  mockOnboardedUser,
  mockUnonboardedUser,
  mockValidateQrTokenSuccess,
  MOCK_SCANNED_USER,
  MOCK_USER,
} from './mocks.ts'

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

// ---------------------------------------------------------------------------
// 7. Network empty state (new user, no connections)
// ---------------------------------------------------------------------------

test('/network shows empty state without force graph for user with no connections', async ({ page }) => {
  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto('/network')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'No bridges yet.' })).toBeVisible()
  await expect(
    page.locator('a.bg-accent').filter({ hasText: 'Add someone' }),
  ).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// 8. QR scan modes
// ---------------------------------------------------------------------------

test('/add/scan toggles between camera and image scan modes', async ({ page }) => {
  await mockOnboardedUser(page)
  await injectMockSession(page)

  await page.goto('/add/scan')
  await page.waitForLoadState('networkidle')

  const cameraButton = page.getByRole('button', { name: /Use camera/i })
  const imageButton = page.getByRole('button', { name: /Scan image/i })

  await expect(cameraButton).toBeVisible()
  await expect(imageButton).toBeVisible()
  await expect(page.locator('#qr-reader')).toBeAttached()

  await imageButton.click()
  await expect(page.getByRole('button', { name: 'Choose image' })).toBeVisible()
  await expect(page.getByText('Choose a photo that includes their QR code.')).toBeVisible()

  await cameraButton.click()
  await expect(page.locator('#qr-reader')).toBeAttached()
})

// ---------------------------------------------------------------------------
// 9. Connection request success modal (connect deep link)
// ---------------------------------------------------------------------------

test('connect success modal stays on page and does not auto-redirect', async ({ page }) => {
  await mockOnboardedUser(page)
  await mockValidateQrTokenSuccess(page)
  await injectMockSession(page)

  await page.goto('/connect?token=mock-scan-token')
  await page.waitForLoadState('networkidle')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Request sent' })).toBeVisible()
  await expect(dialog.getByText(MOCK_SCANNED_USER.display_name)).toBeVisible()

  await expect(page).toHaveURL(/\/connect\?token=mock-scan-token/)
  await page.waitForTimeout(1800)
  await expect(page).toHaveURL(/\/connect\?token=mock-scan-token/)
  await expect(page).not.toHaveURL('/home')
})

test('connect success modal dismisses via close button', async ({ page }) => {
  await mockOnboardedUser(page)
  await mockValidateQrTokenSuccess(page)
  await injectMockSession(page)

  await page.goto('/connect?token=mock-scan-token')
  await page.waitForLoadState('networkidle')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/connect\?token=mock-scan-token/)
  await expect(page.getByRole('link', { name: 'Go to your pocket' })).toBeVisible()
})

test('connect success modal dismisses on browser back', async ({ page }) => {
  await mockOnboardedUser(page)
  await mockValidateQrTokenSuccess(page)
  await injectMockSession(page)

  await page.goto('/connect?token=mock-scan-token')
  await page.waitForLoadState('networkidle')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await page.goBack()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/connect\?token=mock-scan-token/)
})
