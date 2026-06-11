# Specification: Onboarding Robustness

## Status: COMPLETE

## Feature: Onboarding Layout & Navigation Resilience

### Overview
The 3-step onboarding wizard (`/welcome`) has two regressions that block new users from completing signup reliably. First, the page layout now exceeds the visible viewport on typical mobile screens, forcing users to scroll to reach Continue, Back, and Finish actions that previously fit on one screen. Second, using the device or browser back gesture during Google OAuth (e.g. backing out of the Google Account picker midway through onboarding) lands users on the global "Something broke." error screen — and neither **Try again** nor **Go home** recovers the session.

This feature restores a single-screen onboarding layout and hardens auth/onboarding navigation so browser history, OAuth interruptions, and route-level errors never trap users in an unrecoverable state.

### User Stories
- As a new user completing onboarding, I want Continue, Back, and Finish always visible without scrolling so I can finish signup quickly on my phone.
- As a new user who backs out of Google sign-in, I want to return to a working in-app screen so I can retry sign-in or continue onboarding without seeing a crash page.
- As any user who hits an unexpected error, I want **Try again** and **Go home** to actually recover so I am never stuck on a dead-end screen.

---

## Functional Requirements

### FR-1: Onboarding actions fit within the visible viewport
Primary action buttons on all three onboarding steps must be reachable without vertical scrolling on common mobile viewports inside the app device frame.

**Acceptance Criteria:**
- [x] On step 1 (display name), the **Continue** button is fully visible without scrolling on a 390×844 viewport (iPhone 14 class) and a 375×667 viewport (iPhone SE class).
- [x] On step 2 (username), **Back** and **Continue** are fully visible without scrolling on the same viewports.
- [x] On step 3 (avatar), **Back** and **Finish** are fully visible without scrolling on the same viewports, including when username availability messages or error text are shown on prior steps (step 3 itself has no dynamic overflow beyond optional error message).
- [x] Step progress dots and "Step X of 3" label remain visible at the top without pushing actions below the fold.
- [x] Layout respects safe-area and browser chrome insets (`--app-safe-top`, `--app-safe-bottom`) already used by the app shell.
- [x] No regression to onboarding content readability (headings, inputs, avatar picker remain usable).

### FR-2: Graceful recovery when backing out of Google OAuth during onboarding
If a user initiates or re-enters Google sign-in during the onboarding journey and uses native/browser back from the Google Account selection screen (or any OAuth provider page), the app must not crash or show the route error boundary.

**Acceptance Criteria:**
- [x] Backing out of Google OAuth returns the user to a valid in-app route (`/` or `/welcome`), not a blank or error screen.
- [x] If the user already has a valid session but has not finished onboarding, they land on `/welcome` (not `/home`) and can continue from a coherent step — at minimum step 1 with any in-memory form data preserved when possible, or step 1 with empty fields if state cannot be restored.
- [x] If the user has no session after backing out, they land on `/` (landing) and can tap **Sign in with Google** again.
- [x] Re-visiting `/auth/callback` via browser back after a completed callback does not throw an uncaught error or leave the app in a broken render state.
- [x] No infinite redirect loop between `/`, `/auth/callback`, `/welcome`, and `/home`.

### FR-3: Route error boundary recovery actions must work
When the global route error boundary (`Something broke.`) is shown, both recovery actions must reliably restore a usable app state.

**Acceptance Criteria:**
- [x] **Try again** remounts the current route or navigates to a clean instance of it so the user sees a functional page — not the same error screen with no change.
- [x] **Go home** navigates to an appropriate destination: `/home` for onboarded users, `/welcome` for authenticated users without a profile, `/` for unauthenticated users — and the destination renders without error.
- [x] Recovery actions work when triggered from a mobile browser with native navigation history (not only in-app buttons).
- [x] After recovery, the user can continue normal app use without requiring a manual page reload.

### FR-4: Prevent onboarding/auth history traps
Auth and onboarding routes must tolerate forward/back navigation without uncaught render errors.

**Acceptance Criteria:**
- [x] Navigating browser history across `/` → OAuth → `/auth/callback` → `/welcome` in any order that a user might naturally take does not surface the error boundary.
- [x] `AuthCallback` handles repeat mounts, cancelled OAuth, and missing/invalid session tokens without throwing.
- [x] `AuthGuard` redirect logic (`/welcome` vs `/home`) does not throw when auth or profile-ready state is transiently loading or null during history navigation.
- [x] Any fix applied is covered by at least one automated test (unit or E2E) for the OAuth back-navigation case or error-boundary recovery case.

---

## Success Criteria

- 100% of onboarding steps show primary actions above the fold on 375px- and 390px-wide mobile viewports without scrolling.
- Zero user reports of being stuck on "Something broke." after backing out of Google Account selection during signup (verified via manual QA checklist and automated test).
- Error boundary recovery succeeds on first tap of **Try again** or **Go home** in a reproduced failure scenario.
- Existing onboarding E2E smoke test continues to pass; new tests cover layout viewport constraint and OAuth back-navigation recovery.

---

## Dependencies
- Onboarding wizard: `src/pages/Welcome.tsx`
- Auth entry and callback: `src/pages/Landing.tsx`, `src/pages/AuthCallback.tsx`
- Auth gating: `src/components/layout/AuthGuard.tsx`, `src/hooks/useProfileReady.ts`
- App shell layout: `src/App.tsx`, `src/index.css` (`.app-device-screen`, safe-area insets)
- Global error UI: `src/components/layout/RouteErrorBoundary.tsx`

## Assumptions
- The regression in step layout is caused by the app device frame (`min-h-screen` inside a fixed-height scroll container) rather than a specific new form field; the fix should align onboarding with the shell's height model rather than reverting the device frame.
- "Google Account selection" refers to the system/browser OAuth provider UI reached via **Sign in with Google**, not an in-app screen.
- Preserving partial onboarding form data across OAuth interruption is desirable but not required if technically infeasible; landing on a working `/welcome` step 1 is the minimum acceptable outcome.
- Scope includes hardening `RouteErrorBoundary` recovery globally because the reported **Try again** / **Go home** failure affects all routes, but implementation should stay minimal and focused on the onboarding/auth failure path.

---

## Edge Cases

| Scenario | Expected behavior |
|----------|-------------------|
| User backs out of Google OAuth before any session exists | Land on `/`, can sign in again |
| User backs out of Google OAuth with active session, profile incomplete | Land on `/welcome`, no error boundary |
| User presses back from `/welcome` step 2 to step 1 | In-wizard back works (existing behavior preserved) |
| User browser-back from `/welcome` to `/auth/callback` | Callback re-runs safely or redirects without throw |
| User browser-back from `/welcome` to `/` while authenticated | Redirect to `/welcome` via AuthGuard, no error |
| Error boundary shown due to unrelated route bug | **Go home** still routes to correct destination by auth/profile state |
| Soft keyboard open on username step | Action buttons remain reachable (scroll acceptable only while keyboard is open) |
| Landscape orientation on small phone | Actions remain reachable or page scrolls minimally; no worse than portrait |

---

## Completion Signal

### Implementation Checklist
- [x] Fix `/welcome` layout so step actions are pinned within the app device viewport on mobile (all 3 steps).
- [x] Harden OAuth callback and auth/onboarding history navigation so backing out of Google OAuth never triggers an uncaught error.
- [x] Fix `RouteErrorBoundary` so **Try again** and **Go home** reliably recover (remount, navigate, or reset by auth state).
- [x] Add automated test coverage for at least one of: OAuth back-navigation recovery, error-boundary recovery, or onboarding viewport layout.
- [x] Update `DEVDOC.md` onboarding and auth sections if behavior changes.

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New tests added for new functionality
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Edge cases handled
- [x] Error handling in place

#### Visual Verification (if UI)
- [x] Desktop view looks correct
- [x] Mobile view looks correct (375px and 390px widths)
- [x] Design matches style guide

#### Console/Network Check (if web)
- [x] No JavaScript console errors during onboarding flow
- [x] No failed network requests during normal onboarding
- [x] No 4xx or 5xx errors during normal onboarding

#### Manual QA (required for this spec)
- [x] Complete all 3 onboarding steps on mobile viewport without scrolling for buttons (keyboard closed)
- [x] Start Google sign-in, reach Google Account picker, press device back — app shows landing or welcome, not error screen
- [x] If error boundary is triggered in a test scenario, **Try again** and **Go home** both work on first tap

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
