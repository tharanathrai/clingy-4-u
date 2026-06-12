/**
 * Profile back navigation E2E — spec 010
 *
 * Proves other-user profile BackHeader behavior with mocked Supabase:
 * 1. Feed author tap → profile → back to feed
 * 2. Network View profile (returnTo) → back to network
 * 3. Cold /profile/:username → back to /home
 * 4. Own /profile/me has no back header
 */

import { test, expect } from '@playwright/test'
import {
  E2E_SUPABASE_URL,
  injectMockSession,
  mockConnectedFriendScenario,
  MOCK_FRIEND,
  restoreNetworkNodeSelection,
} from './mocks.ts'

async function setupConnectedUser(page: import('@playwright/test').Page): Promise<void> {
  await mockConnectedFriendScenario(page)
  await injectMockSession(page)
}

test('feed author tap opens other-user profile with back and returns to feed', async ({
  page,
}) => {
  await setupConnectedUser(page)

  await page.goto('/feed')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: MOCK_FRIEND.display_name }).click()
  await expect(page).toHaveURL(`/profile/${MOCK_FRIEND.username}`)
  await expect(page.getByRole('button', { name: 'back' })).toBeVisible()
  await expect(page.getByText(MOCK_FRIEND.display_name).first()).toBeVisible()

  await page.getByRole('button', { name: 'back' }).click()
  await expect(page).toHaveURL('/feed')
})

test('network View profile with returnTo returns to network on back', async ({ page }) => {
  await setupConnectedUser(page)

  await page.goto('/network')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('canvas')).toBeVisible()

  await restoreNetworkNodeSelection(page, MOCK_FRIEND.id)

  const viewProfile = page.getByRole('button', { name: 'View profile' })
  await expect(viewProfile).toBeVisible()
  await viewProfile.click()

  await expect(page).toHaveURL(`/profile/${MOCK_FRIEND.username}`)
  await expect(page.getByRole('button', { name: 'back' })).toBeVisible()

  await page.getByRole('button', { name: 'back' }).click()
  await expect(page).toHaveURL('/network')
})

test('cold open other-user profile falls back to home on back', async ({ page }) => {
  await setupConnectedUser(page)
  // Playwright adds a prior history entry; simulate true cold open (history.length === 1).
  await page.addInitScript(() => {
    Object.defineProperty(window.history, 'length', { get: () => 1, configurable: true })
  })

  await page.goto(`/profile/${MOCK_FRIEND.username}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'back' })).toBeVisible()
  await page.getByRole('button', { name: 'back' }).click()
  await expect(page).toHaveURL('/home')
})

test('profile new gum back returns to profile when returnTo is set (C-02)', async ({ page }) => {
  await setupConnectedUser(page)

  await page.route(`${E2E_SUPABASE_URL}/rest/v1/bridges*`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto(`/profile/${MOCK_FRIEND.username}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'New gum' }).click()
  await expect(page).toHaveURL('/piece/new')
  await expect(page.getByText('Sam Friend')).toBeVisible()

  const backLink = page.getByRole('link', { name: 'back' })
  await expect(backLink).toHaveAttribute('href', `/profile/${MOCK_FRIEND.username}`)
  await backLink.click()
  await expect(page).toHaveURL(`/profile/${MOCK_FRIEND.username}`)
})

test('own profile at /profile/me does not show back header', async ({ page }) => {
  await setupConnectedUser(page)

  await page.goto('/profile/me')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'back' })).not.toBeVisible()
  await expect(page.getByText('Test User')).toBeVisible()
})
