# Specification: UI Consistency Audit

## Status: COMPLETE

## Feature: Cross-Screen Layout & Visual Consistency

### Overview
Layout and visual patterns have diverged across screens as features landed independently. Some pages use the app shell height model (`safe-screen-height` inside `.app-device-screen`); others still use `min-h-screen`, which overflows the fixed device frame and causes double-scroll or actions pushed below the fold. Horizontal padding, top/bottom safe-area clearance, page titles, and back-header patterns also vary screen to screen — especially across the new-user journey (landing → onboarding → add → connect) and secondary flows (piece detail, profile, settings, graveyard).

This feature performs a full UI audit against `DESIGN.md`, documents the canonical layout patterns, and brings every screen and user journey into alignment so the app feels like one cohesive product on mobile viewports (375×667 and 390×844 minimum).

### User Stories
- As a new user going through onboarding and my first connection, I want every step to look and behave like the same app so I trust the product and can always reach primary actions without awkward scrolling.
- As a returning user moving between pocket, network, feed, profile, and deep-linked flows (piece detail, confirm, settings), I want consistent headers, spacing, and viewport behavior so navigation feels predictable.
- As a developer/design reviewer, I want documented layout standards and a screen inventory so future features do not reintroduce one-off layout drift.

---

## Functional Requirements

### FR-1: Audit inventory and layout standards
Before changing pages, produce an audit that maps every routed screen to its layout shell, height model, padding, header pattern, and known deviations from `DESIGN.md`.

**Acceptance Criteria:**
- [x] Audit covers every route in `PRD.md` §13 (auth, onboarding, core tabs, profile, connections, gum piece, settings) plus loading, error, and empty states for each.
- [x] Audit identifies pages using `min-h-screen` vs `safe-screen-height` and flags any that can overflow `.app-device-screen`.
- [x] Audit identifies inconsistent horizontal padding (target: 20px / `px-5` per DESIGN.md), top inset (`safe-content-top` vs ad-hoc `py-8` / `pt-6` / `mt-*` on titles), and bottom clearance for tab-bar vs non-tab screens.
- [x] Audit identifies page title casing drift (DESIGN.md §4: sentence case for screen titles — e.g. "your pocket", not "Connect" or "Connection requests").
- [x] A short **Layout Standards** section is added to `DEVDOC.md` (or a linked doc referenced from it) defining: (a) tab-bar screens → `Layout` component, (b) full-bleed/fixed screens → `safe-screen-height` + documented padding tokens, (c) centered auth/onboarding → pinned footer actions pattern from `Welcome.tsx`, (d) back-header screens → shared back control sizing and placement.
- [x] No `[NEEDS CLARIFICATION]` markers remain unresolved at implementation start.

### FR-2: Viewport height model consistency
All screens must respect the app device frame height model. No page should rely on `min-h-screen` or unconstrained vertical growth that forces scroll just to reach primary actions on standard mobile viewports (except when the soft keyboard is open or content genuinely exceeds one screen).

**Acceptance Criteria:**
- [x] Every page `main` (or equivalent root content wrapper) uses `safe-screen-height` or the shared `Layout` component — not raw `min-h-screen`.
- [x] Auth and onboarding screens (`/`, `/auth/callback`, `/welcome`) keep primary actions visible without scroll on 390×844 and 375×667 (regression guard for spec 002).
- [x] Connection onboarding path (`/add`, `/add/scan`, `/connect`) uses the same height model and does not require scroll to reach primary CTAs on those viewports in default empty/happy states.
- [x] Secondary flows (`/piece/new`, `/piece/:id`, `/piece/:id/confirm`, `/home/graveyard`, `/settings`, `/profile/me`, `/profile/:username`, connection requests) do not exhibit double scrollbars inside `.app-device-screen`.
- [x] Loading and error fallbacks inside pages (and `AuthGuard` / route suspense spinner) use the same height model — not `min-h-screen`.

### FR-3: Spacing and safe-area alignment
Horizontal and vertical spacing must follow DESIGN.md §5 and existing CSS utilities in `index.css`.

**Acceptance Criteria:**
- [x] Horizontal page padding is consistently 20px (`px-5`) on all screens unless a component spec explicitly requires edge-to-edge (e.g. network graph canvas).
- [x] Tab-bar screens (`/home`, `/network`, `/feed`, `/notifications`, `/profile/me`) use `Layout` or equivalent `safe-content-top` + `safe-content-bottom` / `pb-tab-clearance` so content is not hidden under the tab bar.
- [x] Non-tab screens with fixed bottom actions use `pb-[var(--app-safe-bottom)]` or documented clearance utilities — not ad-hoc mixes of `pb-28`, `pb-8`, and `pb-72` unless justified in the audit (confirmation ceremony is allowed extra bottom space for hero layout).
- [x] Top spacing for screens with a back button uses a consistent header row pattern (back control + optional title) aligned with existing working examples (`Settings.tsx`, `AddScan.tsx`, `Graveyard.tsx`).

### FR-4: Header, title, and navigation control consistency
Screen titles and back affordances must feel like one system.

**Acceptance Criteria:**
- [x] All `app-page-title` headings use sentence case per DESIGN.md (fix outliers such as "Connect", "Connection requests", "Add someone" unless the title is a proper name like a user's display name).
- [x] Back navigation on push screens uses the same icon (`ArrowLeft`, `size={18}`, `strokeWidth={1.75}`), minimum 44×44px touch target, and top placement — no one-off text links like "Back to app" unless used as secondary action below primary content.
- [x] Tab-bar screens do not duplicate back buttons; push screens do not render the bottom tab bar unless already routed through a tab parent (preserve existing `App.tsx` behavior).
- [x] Profile header icon actions (settings, graveyard per spec 001) align visually with back-header touch targets on other screens.

### FR-5: Onboarding and first-connection journey polish
The new-user path must feel continuous from first sign-in through first connection.

**Acceptance Criteria:**
- [x] Journey screens visually align: `/` → `/welcome` (3 steps) → `/add` → `/add/scan` or QR display → `/connect` (when applicable) → `/profile/me` or `/home`.
- [x] Step progress UI on `/welcome` remains visible without pushing actions below the fold (spec 002 regression guard).
- [x] `/add` and `/add/scan` share consistent header/back treatment and vertical rhythm with `/welcome`.
- [x] `/connect` states (loading, error, success, invalid token) use the same layout shell and title casing as other connection screens — not a separate centered `min-h-screen` island.
- [x] Transitions between these screens use existing route transition classes in `App.tsx` without layout jump (no sudden padding or title size change between adjacent steps).

### FR-6: Empty, loading, and error state consistency
Every screen's non-happy paths must match the same layout shell as its happy path.

**Acceptance Criteria:**
- [x] Empty states keep DESIGN.md §13 structure (illustration, Bagel Fat One headline, subline, single CTA) and sit within the same page shell — not a differently padded wrapper.
- [x] Inline loading spinners and skeleton states occupy the same viewport region as loaded content (no layout shift > 8px on load complete for above-the-fold headers).
- [x] Error messages use warm app voice and appear in consistent placement relative to primary actions (below form fields on forms; centered block on fetch failures).
- [x] `RouteErrorBoundary` recovery UI remains full-viewport and unaffected by page-level layout refactors except where shared tokens improve alignment.

---

## Success Criteria

- A reviewer can open any two screens side by side on a 390×844 viewport and see matching horizontal padding, title typography, and header/back patterns without one-off spacing hacks.
- No routed screen uses `min-h-screen` on its root content wrapper.
- New-user journey from landing through add/connect completes without needing scroll to reach primary actions on standard mobile viewports (keyboard-open exception allowed on text fields).
- `npm run quality` passes after all layout changes.
- `DEVDOC.md` documents the canonical layout patterns so future specs reference them.

---

## Dependencies
- Design system: `DESIGN.md` (spacing, typography, empty states, voice)
- App shell: `src/App.tsx`, `src/index.css` (`.app-device-screen`, `safe-screen-height`, safe-area utilities)
- Shared layout: `src/components/layout/Layout.tsx`
- Onboarding reference implementation: `src/pages/Welcome.tsx` (pinned footer actions)
- Prior fixes: `specs/002-onboarding-robustness` (viewport regression guard — must not regress)
- Profile header: `specs/001-profile-graveyard-icon` (header icon alignment should be preserved)

## Assumptions
- Scope is layout, spacing, viewport behavior, headers, and title consistency — not a full visual redesign, new illustrations, or animation changes unless required to fix layout breakage.
- `max-w-md` (448px) remains the content cap; DESIGN.md's 480px max width is close enough and not changed in this spec.
- Shared layout primitives may be extracted (e.g. `PageShell`, `BackHeader`) if that reduces duplication — but only where the audit shows ≥3 screens share the same pattern.
- Desktop/wide viewports inherit mobile layout centered in the device frame; no separate desktop layout is required.
- E2E smoke tests may need viewport-size assertions added for critical journeys; visual regression snapshots are optional, not required.

---

## Edge Cases

| Scenario | Expected behavior |
|----------|-------------------|
| Soft keyboard open on username/display-name fields | Primary actions may scroll into view; layout must not permanently break when keyboard closes |
| Landscape on small phone | Actions remain reachable; no worse than portrait |
| Long display name on profile title | Title truncates or wraps without overlapping header icons |
| Piece confirm / OTP ceremony hero layout | May use extra bottom padding for ceremony content; still uses `safe-screen-height`, not `min-h-screen` |
| Network graph full-bleed canvas | Edge-to-edge graph is allowed; header chrome still follows spacing standards |
| Modal sheets and bottom sheets | Unaffected by page shell changes except z-index/safe-area must not regress |
| `prefers-reduced-motion` | Layout changes do not remove reduced-motion guards on animations |

---

## Out of Scope
- New features or copy changes unrelated to consistency
- Color token changes or typography scale changes in `DESIGN.md`
- Network graph physics, gum piece visuals, or confirmation ceremony animation redesign
- Capacitor native safe-area differences beyond existing CSS variables

---

## Completion Signal

### Implementation Checklist
- [x] Complete screen inventory audit (FR-1) with deviations listed per route
- [x] Document layout standards in `DEVDOC.md` (FR-1)
- [x] Replace `min-h-screen` root wrappers with `safe-screen-height` or `Layout` on all flagged pages (FR-2)
- [x] Normalize padding and safe-area utilities on all flagged pages (FR-3)
- [x] Normalize `app-page-title` casing and back-header patterns (FR-4)
- [x] Polish onboarding → add → connect journey layouts (FR-5)
- [x] Align loading, empty, and error states with happy-path shells (FR-6)
- [x] Update `DEVDOC.md` flow status entries for any screens touched

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New or updated tests cover layout utilities or shared shell components if extracted
- [x] No lint errors
- [x] `npm run quality` passes

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Spec 002 onboarding viewport criteria still pass (no regression)
- [x] Edge cases in table above manually checked on at least 390×844 viewport

#### Visual Verification (if UI)
- [x] Desktop view (device frame centered) looks correct
- [x] Mobile viewports 390×844 and 375×667 look correct on: `/`, `/welcome` (all 3 steps), `/add`, `/add/scan`, `/connect`, `/home`, `/network`, `/feed`, `/notifications`, `/profile/me`, `/settings`, `/piece/new`, `/home/graveyard`
- [x] No double scrollbars inside device frame on audited screens
- [x] Design matches `DESIGN.md` spacing and title rules

#### Console/Network Check (if web)
- [x] No JavaScript console errors on smoke-tested routes
- [x] No failed network requests during smoke flows
- [x] No 4xx or 5xx errors during smoke flows

### Iteration Instructions

If ANY check fails:
1. Identify the specific screen and deviation (reference audit row)
2. Fix the layout using documented standards — avoid one-off page hacks
3. Run tests again
4. Re-verify viewports for affected journeys
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
