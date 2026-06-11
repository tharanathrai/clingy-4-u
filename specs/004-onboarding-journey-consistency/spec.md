# Specification: Onboarding Journey Consistency

## Status: COMPLETE

## Feature: New-User Journey Layout & Viewport Alignment

### Overview
Despite prior layout work (specs 002 and 003), the new-user journey still feels like disconnected screens rather than one continuous flow. Layout drift has propagated across onboarding and first-connection steps: viewport height handling, pinned vs centered footers, title typography, horizontal width caps, and tab-bar clearance differ screen to screen.

This spec performs a **focused audit and fix** of the early-journey path only — from first visit through first connection — so every step uses the same shell tokens, spacing rhythm, and above-the-fold action placement defined in `DESIGN.md` §2 and `DEVDOC.md` Layout Standards.

**In scope routes:** `/`, `/auth/callback`, `/welcome`, `/add`, `/add/scan`, `/connect`

**Out of scope:** Core tab screens, piece flows, profile/settings, and graveyard (covered by spec 003).

### User Stories
- As a new user completing onboarding, I want each step to look and feel like the same app so I trust the product and never hunt for buttons below the fold.
- As a new user who just finished profile setup, I want the add/QR screen to feel like a natural continuation of the wizard — not a sudden layout shift — so I know what to do next.
- As a user scanning or sharing a connect link during first contact, I want consistent headers, spacing, and reachable CTAs so connection errors and success states feel part of the same journey.
- As a developer, I want onboarding pages to import shared `pageShell` tokens instead of duplicating class strings so future changes do not reintroduce drift.

---

## Known Drift (Pre-Implementation Audit)

| Issue | Screens | Current state |
|-------|---------|---------------|
| Pinned footer claimed but not implemented | `/add` | Uses `pageShellPinnedFooter` but centers all content with `justify-center`; Refresh / Switch to scan are inline, not `mt-auto` pinned |
| Journey layout jump | `/welcome` → `/add` | Wizard: left-aligned, step dots, `font-display text-4xl`, no tab bar → Add: centered, `BackHeader`, `app-page-title`, tab bar visible |
| Shell token duplication | `/welcome`, `/`, `/auth/callback` | Inline `safe-screen-height` strings instead of `pageShellPinnedFooter` / `pageShellCentered` |
| Tab bar overlap | `/connect` | `pageShellScroll` with `pb-8` only; no `pb-tab-clearance` or `safe-content-bottom` while `BottomTabBar` may render |
| Width cap inconsistency | `/` | Inner content uses `max-w-sm`; journey standard is `max-w-md` via `pageShellBase` |
| Add vs AddScan rhythm | `/add`, `/add/scan` | Different shells (`pageShellPinnedFooter` vs `pageShellScroll safe-content-bottom py-8`); title spacing differs (`mt-4` on scan only) |
| QR pushes CTAs on small viewports | `/add` | 288px QR (`h-72 w-72`) + header + copy + inline buttons may require scroll on 375×667 |

---

## Functional Requirements

### FR-1: Journey audit and deviation log
Before changing code, confirm the drift table above against live pages and extend it if new inconsistencies are found.

**Acceptance Criteria:**
- [x] Audit documents shell token, alignment, title class, footer pattern, and tab-bar clearance for all six in-scope routes.
- [x] Audit notes any page using ad-hoc class strings where a `pageShell*` token exists.
- [x] Deviations are mapped to FR-2 through FR-6 fixes (no orphan issues).
- [x] Updated journey notes are appended to `DEVDOC.md` Layout Standards screen inventory (in-scope rows only).

### FR-2: Canonical shell tokens on every journey screen
Each in-scope screen must use the shared tokens from `src/components/layout/pageShell.ts` — no duplicated shell strings.

**Acceptance Criteria:**
- [x] `/welcome` imports and uses `pageShellPinnedFooter` (replaces inline equivalent).
- [x] `/` and `/auth/callback` use `pageShellCentered` for loading and content states.
- [x] `/add` uses `pageShellPinnedFooter` with `pb-tab-clearance` (tab bar visible per DESIGN.md).
- [x] `/add/scan` and `/connect` use `pageShellScroll` with appropriate bottom clearance when tab bar is visible (`pb-tab-clearance` or `safe-content-bottom`).
- [x] No in-scope route root uses `min-h-screen`.
- [x] Loading fallbacks on journey routes include `max-w-md` via shell tokens (not bare centered full-width blocks).

### FR-3: Pinned footer actions on onboarding-critical screens
`DESIGN.md` §2 requires `safe-screen-height` with pinned footer actions on onboarding. Primary CTAs must stay above the fold on 375×667 and 390×844 (keyboard-open exception on text fields).

**Acceptance Criteria:**
- [x] `/welcome` all three steps: Continue / Back / Finish remain in `mt-auto` footer rows — **no regression** from spec 002.
- [x] `/add`: primary actions (Refresh now, Switch to scan) move to a pinned `mt-auto` footer row; QR and descriptive copy live in a `flex-1 min-h-0` scroll region if content exceeds viewport.
- [x] On 375×667 and 390×844, `/add` action row is fully visible without scrolling when keyboard is closed.
- [x] `/connect` error/success CTAs remain reachable; if content exceeds viewport, scroll area is above actions — not the reverse.

### FR-4: Visual continuity across the journey
Adjacent steps must not introduce sudden padding, alignment, or title-size jumps.

**Acceptance Criteria:**
- [x] `/welcome`, `/add`, `/add/scan`, `/connect` share `BackHeader` placement and touch targets once back navigation is shown (Welcome step 1 may omit back — preserve existing wizard behavior).
- [x] Post-welcome screens (`/add`, `/add/scan`, `/connect`) use `app-page-title` in sentence case for screen titles.
- [x] Welcome step headings use `app-page-title` OR remain `font-display text-4xl` with documented rationale in `DEVDOC.md` — but spacing (`mt-2` subline, label `mt-8`) must match across wizard steps.
- [x] Horizontal padding is consistently `px-5` / `max-w-md` on all journey screens (Landing inner content widened from `max-w-sm` to `max-w-md` unless hero layout requires narrower copy block — if so, outer shell still uses `max-w-md`).
- [x] Transition from `/welcome` → `/add` does not change background, horizontal inset, or title line-height in a way that feels like a different app.

### FR-5: Tab bar and safe-area clearance
Screens that render `BottomTabBar` (via `AuthGuard` when `profileReady`) must not hide primary CTAs under the tab bar.

**Acceptance Criteria:**
- [x] `/add` retains `pb-tab-clearance` with pinned footer above tab bar.
- [x] `/connect` applies `pb-tab-clearance` or `safe-content-bottom` on all non-loading states when tab bar is shown.
- [x] `/add/scan` bottom clearance matches `/add` / `/connect` pattern (no mix of `pb-8` only vs `safe-content-bottom` without justification).
- [x] Primary buttons on `/connect` (e.g. Go to pocket, Sign in with Google, Dismiss) are fully tappable with tab bar visible on 390×844.

### FR-6: Loading, error, and empty states use the same shell
Non-happy paths on journey screens must not switch to a different layout island.

**Acceptance Criteria:**
- [x] `/connect` loading state uses `pageShellCentered` without redundant duplicate utilities (e.g. extra `px-5` when already in `pageShellBase`).
- [x] Fetch/token errors on `/add` render inside the same pinned-footer shell — not a centered `min-h-screen` block.
- [x] OAuth callback spinner (`/auth/callback`) uses `pageShellCentered`.
- [x] Connect error cards (expired token, already connected, etc.) keep the same header + title chrome as the happy path.

---

## Success Criteria

- A reviewer stepping through `/` → OAuth → `/welcome` (3 steps) → `/add` → `/add/scan` or `/connect` on 390×844 sees consistent horizontal padding, header rhythm, and reachable primary actions without layout jumps between adjacent steps.
- `/add` primary actions are pinned and visible without scroll on 375×667 (keyboard closed).
- `/connect` CTAs are not obscured by the tab bar when `profileReady` is true.
- All six in-scope routes import `pageShell*` tokens — zero duplicated shell strings in page files.
- Spec 002 onboarding viewport criteria still pass (Welcome regression guard).
- `npm run quality` passes after changes.

---

## Dependencies
- Design system: `DESIGN.md` §2 (onboarding ends at add screen; pinned footer pattern)
- Layout tokens: `src/components/layout/pageShell.ts`, `src/components/layout/BackHeader.tsx`
- App shell: `src/App.tsx`, `src/index.css` (safe-area utilities)
- Tab bar injection: `src/components/layout/AuthGuard.tsx`, `src/components/layout/BottomTabBar.tsx`
- Prior specs: `specs/002-onboarding-robustness` (must not regress), `specs/003-ui-consistency-audit` (broader audit — this spec closes journey-specific gaps)

## Assumptions
- Scope is layout, spacing, viewport behavior, and shell-token alignment — not copy changes, new illustrations, or animation redesign.
- Landing hero typography (`text-5xl` app name) may remain larger than `app-page-title` as a brand moment; shell and padding must still align with journey tokens.
- Shared primitives (`pageShellPinnedFooter`, `BackHeader`) are sufficient; a new component is only justified if ≥3 screens share identical pinned-footer structure after refactor.
- Desktop view inherits mobile layout inside the device frame; no separate desktop layout.
- Automated tests: extend existing viewport or route tests where practical; full visual regression snapshots are optional.

---

## Edge Cases

| Scenario | Expected behavior |
|----------|-------------------|
| Soft keyboard open on username/display-name steps | Actions may scroll into view; layout recovers when keyboard closes |
| Landscape on small phone | Primary actions remain reachable or scroll minimally |
| `/add` token refresh error | Error text appears without breaking pinned footer or pushing actions off-screen |
| `/connect` deep link while unauthenticated | Sign-in CTA visible and tappable; layout matches authenticated connect states |
| User completes onboarding and lands on `/add` with tab bar | QR may scroll; action row stays pinned above tab bar |
| Browser back from `/add` to `/welcome` | No layout throw; wizard step state preserved (existing behavior) |
| `prefers-reduced-motion` | Layout changes do not remove existing reduced-motion guards |

---

## Out of Scope
- Core tab screens (`/home`, `/network`, `/feed`, `/notifications`, `/profile/me`)
- Piece creation, detail, confirmation, and graveyard layouts
- Color, typography scale, or voice changes in `DESIGN.md`
- Native Capacitor safe-area differences beyond existing CSS variables
- Graveyard icon placement (spec 001)

---

## Completion Signal

### Implementation Checklist
- [x] Complete journey audit and update `DEVDOC.md` inventory rows (FR-1)
- [x] Migrate `/welcome`, `/`, `/auth/callback` to `pageShell*` tokens (FR-2)
- [x] Refactor `/add` to true pinned-footer layout with scrollable content region (FR-3)
- [x] Align title, header, and padding continuity across journey screens (FR-4)
- [x] Fix tab-bar clearance on `/connect` and harmonize `/add/scan` bottom spacing (FR-5)
- [x] Normalize loading/error shells on journey routes (FR-6)
- [x] Manual QA at 375×667 and 390×844 on full journey path
- [x] Confirm spec 002 Welcome regression guard still passes

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration/E2E tests pass
- [x] New or updated tests for journey shell tokens or viewport constraints if extracted
- [x] No lint errors
- [x] `npm run quality` passes

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Spec 002 Welcome pinned-footer criteria still pass
- [x] Edge cases in table above manually checked

#### Visual Verification (if UI)
- [x] Mobile viewports 390×844 and 375×667 correct on: `/`, `/welcome` (all 3 steps), `/add`, `/add/scan`, `/connect` (loading, error, success)
- [x] No double scrollbars inside `.app-device-screen` on journey routes
- [x] Adjacent-step transitions (`/welcome`→`/add`, `/add`→`/add/scan`, `/add`→`/connect`) show no jarring padding or title jumps
- [x] Design matches `DESIGN.md` §2 and `DEVDOC.md` Layout Standards

#### Console/Network Check (if web)
- [x] No JavaScript console errors on journey smoke path
- [x] No failed network requests during normal onboarding → add flow
- [x] No 4xx or 5xx errors during normal onboarding → add flow

#### Manual QA (required for this spec)
- [x] Complete all 3 Welcome steps without scrolling for buttons (keyboard closed) — spec 002 guard
- [x] `/add` Refresh now and Switch to scan visible without scroll on 375×667 (keyboard closed)
- [x] `/connect` primary CTA not hidden under tab bar when logged in with profile

### Iteration Instructions

If ANY check fails:
1. Identify the specific route and deviation (reference Known Drift table or audit log)
2. Fix using `pageShell*` tokens and documented patterns — avoid one-off page hacks
3. Run tests again
4. Re-verify viewports for affected journey steps
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
