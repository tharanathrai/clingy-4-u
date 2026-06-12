# Specification: Contextual State & Navigation Audit

## Status: COMPLETE

## Feature: Deep-State Bug Audit and Hardening Plan

### Overview
Spec `013` fixed a contextual bug on the profile shared-bridges flow: `BridgeDetailSheet` reused from the network graph showed **Make plan** / **View profile** CTAs and a blank viewer avatar because entry-point context was not wired. Bugs like this erode UX credibility — the UI looks broken or nonsensical even when underlying data is correct.

This spec is a **read-first audit and phased hardening plan**. It inventories similar risks across navigation state (`location.state`, browser history, overlay stacks), shared sheet/modal components, stale entity taps, and module-level caches. It prioritizes fixes that are small, testable, and unlikely to regress flows already covered by specs `007`, `010`, `012`, and `013`.

**In scope:** Audit document, navigation-context conventions, targeted fixes for confirmed high-confidence bugs, unit/E2E tests for each fix, `DEVDOC.md` / `IMPLEMENTATION_PLAN.md` updates.

**Out of scope:** New product features, schema/RLS changes, full rewrite of routing, automating all 14 manual regression items (spec `011`).

### User Stories
- As a user opening a bridge from someone's profile, I want the sheet to reflect where I am — no redundant actions, complete participant info (addressed in `013`; must not regress).
- As a user who opened a profile from the network graph, I want back navigation and CTAs to preserve my graph context — not dump me on `/home`.
- As a user reading a post and tapping a commenter's name, I want to return to the post I was reading, not lose my place in the feed.
- As a user tapping notifications about plans that no longer exist, I want clear feedback — not a broken piece detail screen.
- As a developer, I want a documented entry-point × component matrix so shared UI cannot silently ship with the wrong context again.

---

## Audit Summary (Pre-Implementation)

### Pattern that caused spec 013

| Pattern | Risk | Example |
|---------|------|---------|
| Shared sheet without entry context | Wrong CTAs, missing data, redundant navigation | `BridgeDetailSheet` always rendered network actions |
| Hardcoded UI placeholders | Missing avatar / wrong labels | "You" card had empty `bg-accent/30` div |
| Implicit "one true entry point" assumption | Regression when second caller added | Profile `BridgeListItem` added later without variant |

### Confirmed findings (prioritized)

#### P1 — High confidence, user-visible, small fix surface

| ID | Finding | Location | User impact | Suggested fix |
|----|---------|----------|-------------|---------------|
| **C-01** | Network bridge detail **View profile** link omits `returnTo` / `selectUserId` | `BridgeDetailSheet.tsx` (network variant) | User opens profile from bridge sheet → back falls through to `/home` instead of restoring network selection (inconsistent with `NodeProfileSheet.onViewProfile`) | Pass same `location.state` as `Network.tsx` `onViewProfile` |
| **C-02** | Profile **New gum** CTA omits `returnTo` | `SharedBridgesSection.tsx` | User on `/profile/:username` taps new gum → `PieceNew` back goes to `/home`, not profile | Pass `returnTo: /profile/:username` (and optional scroll key) |
| **C-03** | Stale notification taps beyond expiry not guarded | `notificationRouting.ts`, `Notifications.tsx` | Tapping `invite_accepted`, `plan_turned_down`, or `plan_expired` for deleted/archived pieces may open empty/error piece detail | Extend `resolveStaleGumPieceTap` (or sibling helper) for terminal piece statuses (`confirmed`, `turned_down`, `expired`) on route types that still navigate to `/piece/:id` |
| **C-04** | Feed post detail → profile navigation drops overlay context | `PostDetailSheet.tsx`, `Feed.tsx` | User opens post → taps author/commenter → profile → back returns to feed **without** reopening post detail (spec `007` minimum met; UX gap remains) | Pass `returnTo: '/feed'` + `restorePostId` in state; Feed reads state on mount to reopen sheet OR close sheet before navigate and document as accepted limitation |

#### P2 — Medium confidence, context/history edge cases

| ID | Finding | Location | User impact | Suggested fix |
|----|---------|----------|-------------|---------------|
| **C-05** | `location.state` lost on refresh / external open | `PieceNew`, `Network`, `ProfileUser` | Deep-linked flows lose prefilled recipient or graph selection after reload | Document as accepted; optional URL params for `recipientId` on `/piece/new` (defer unless product asks) |
| **C-06** | Module-level `networkUserCache` | `Network.tsx` | Stale display name/avatar on node sheet after profile edit elsewhere | Invalidate cache entry on profile update mutation or prefer `usersById` from React Query graph hook |
| **C-07** | Profile navigation from feed/post uses history-only | `Feed.tsx`, `PostDetailSheet.tsx` | Works for simple feed→profile→back; fails when overlay stack involved (C-04) | Central `navigateToProfile()` helper with explicit `from` metadata |
| **C-08** | `BridgeListItem` overlay not history-integrated | `BridgeListItem.tsx` | Android/hardware back may not dismiss bridge sheet; differs from `Feed` post detail `pushState` pattern | Align with `pushState` + `popstate` pattern from `Feed.tsx` or document as acceptable for profile-context read-only sheet |
| **C-09** | Connect / AddScan profile links lack `returnTo` | `Connect.tsx`, `AddScan.tsx` | Back from profile relies on history; usually OK from journey push screens | Pass `returnTo` matching journey route when history depth is shallow |

#### P3 — Low priority / document-only

| ID | Finding | Location | Notes |
|----|---------|----------|-------|
| **C-10** | `useProfile` cache keyed by `viewerId` | `useProfile.ts`, `queryKeys.ts` | Duplicate cache entries by-id vs by-username; acceptable per DEVDOC known issue #4 |
| **C-11** | `NodeProfileSheet` duplicates network CTAs | `NodeProfileSheet.tsx` | Intentional for network; not a bug — reference implementation for context-aware actions |
| **C-12** | Piece detail partner link history-only | `PieceDetail.tsx` | Covered by spec `007` history back; no change unless E2E gap found |

### Entry-point × shared-component matrix (living doc)

Implementers must add this table to `DEVDOC.md` §Navigation context and keep it updated when adding shared sheets.

| Component | Network graph | Profile shared bridges | Feed / post detail | Piece detail | Notifications |
|-----------|---------------|------------------------|--------------------|----------------|---------------|
| `BridgeDetailSheet` | CTAs: Make plan, View profile; viewer avatar | Read-only; no CTAs (`variant="profile"`) | N/A | N/A | N/A |
| `NodeProfileSheet` | CTAs: Make plan, View profile | N/A (use full profile page) | N/A | N/A | N/A |
| `PostDetailSheet` | N/A | N/A | Overlay + history entry | N/A | N/A |
| Profile `/profile/:username` | `returnTo` + `selectUserId` from network | Tab root / push from feed | History or `returnTo` | History from partner link | Indirect |

---

## Functional Requirements

### FR-1: Publish audit and navigation-context conventions
Document findings and a single convention for cross-route context so future shared components do not repeat spec `013`.

**Acceptance Criteria:**
- [ ] `DEVDOC.md` gains a **Navigation context** section with: (a) the entry-point matrix above, (b) when to use `returnTo` / `selectUserId` / sheet `variant`, (c) when history-only back is acceptable.
- [ ] `IMPLEMENTATION_PLAN.md` lists P1 items C-01–C-04 as trackable follow-ups (or folded into this spec's implementation phase).
- [ ] Audit IDs (C-01…) referenced in spec remain stable for test naming.

### FR-2: Fix C-01 — Bridge detail View profile preserves network context
Network-opened `BridgeDetailSheet` **View profile** must pass the same navigation state as `NodeProfileSheet.onViewProfile`.

**Acceptance Criteria:**
- [ ] `View profile` link from network bridge detail includes `state: { returnTo: '/network', selectUserId: otherUser.id }`.
- [ ] Back from that profile returns to `/network` with node selection restored (same as spec `010` network path).
- [ ] Profile-context bridge detail (`variant="profile"`) unchanged — no CTA row (spec `013` regression guard).
- [ ] Unit test asserts link state; E2E or unit test covers back-to-network from bridge-detail profile path.

### FR-3: Fix C-02 — Profile new-gum back returns to profile
When the user starts **New gum** from another user's profile, back from `/piece/new` returns to that profile.

**Acceptance Criteria:**
- [ ] `SharedBridgesSection` passes `returnTo: '/profile/:username'` (resolved username) in navigation state.
- [ ] `PieceNew` `BackHeader` navigates to profile on back when `returnTo` is set.
- [ ] Creating a plan still navigates to `/home` with success toast (existing behavior).
- [ ] Unit or E2E test for back target from profile-originated new gum.

### FR-4: Fix C-03 — Stale gum-piece notification taps
Extend stale-entity handling so tapping notifications for pieces in terminal states does not leave the user on a broken detail screen.

**Acceptance Criteria:**
- [ ] `invite_accepted`, `plan_turned_down`, `plan_expired` (and any other `/piece/:id` route types) checked against live `gum_pieces.status` before navigate.
- [ ] Terminal statuses (`confirmed`, `turned_down`, `expired`) dismiss notification with inline toast (copy aligned with existing invite/expiry patterns); no navigation to broken detail.
- [ ] Active / placeholder pieces still route correctly.
- [ ] `notificationRouting.test.ts` extended; no regression to spec `012` branches.

### FR-5: Address C-04 — Feed post detail profile return (phased)
Improve feed overlay restoration when profile is opened from post detail.

**Acceptance Criteria:**
- [ ] **Minimum (required):** Post detail profile taps pass explicit `returnTo: '/feed'` in `location.state` (consistent with network hardening).
- [ ] **Stretch (optional in same spec):** Feed reads `restorePostId` from state on return and reopens `PostDetailSheet`; hardware back closes profile then restores sheet.
- [ ] If stretch deferred, document accepted limitation in `DEVDOC.md` with C-04 ID.
- [ ] No regression to feed author tap → profile → back (spec `010`).

### FR-6: Regression safety net
Prevent contextual bugs from recurring silently.

**Acceptance Criteria:**
- [ ] New unit tests for each implemented C-xx fix.
- [ ] At least one Playwright test added or extended for C-01 or C-02 (profile/network/piece-new context).
- [ ] `docs/regression-matrix.md` session row added when implementation completes.
- [ ] `npm run quality` passes.

### FR-7: P2 items — implement or defer with rationale
C-05–C-09 are not all required for completion; each must be either fixed or explicitly deferred in `DEVDOC.md`.

**Acceptance Criteria:**
- [ ] Each P2 item marked **fixed**, **deferred**, or **wont-fix** with one-line rationale in `DEVDOC.md`.
- [ ] Any P2 item marked **fixed** meets the same test bar as FR-6.

---

## Success Criteria

- No shared sheet or cross-route CTA shows actions inappropriate to the user's current screen (spec `013` pattern cannot recur undetected).
- Network → bridge detail → View profile → back restores graph context (C-01).
- Profile → new gum → back returns to profile (C-02).
- Stale plan-related notification taps show toast and clear row — no blank piece detail (C-03).
- Documented entry-point matrix exists in `DEVDOC.md` for future contributors.
- Zero regressions on specs `007`, `010`, `012`, `013` automated tests.

---

## Recommended Fix Approaches (Non-Regressive)

### 1. Entry-context contract (preferred default)
Introduce a shared TypeScript type (e.g. `AppLocationState`) in `src/lib/navigationContext.ts`:

```ts
// Illustrative — implementers choose exact shape
type AppLocationState = {
  returnTo?: string
  selectUserId?: string
  restorePostId?: string
  toast?: string
}
```

Use it wherever `location.state` is cast. Add a `navigateToProfile({ username, returnTo, selectUserId })` helper to eliminate copy-paste drift between `Network.tsx`, `BridgeDetailSheet`, and `PostDetailSheet`.

### 2. Sheet `variant` pattern (from spec 013)
Any component rendered from more than one route must accept an explicit `variant` or `entryPoint` prop — never infer from global route alone when the parent overlay context differs (e.g. profile page with tab shell vs network overlay).

### 3. History-integrated overlays
For bottom sheets that should respond to hardware back, follow `Feed.tsx`: `pushState` on open, `popstate` listener to close, `history.back()` on explicit close. Apply to `BridgeListItem` only if C-08 is promoted from deferred.

### 4. Stale-entity guard generalization
Extend `notificationRouting.ts` with `resolveGumPieceTap(type, status)` used by all piece-routing notification types. Mirror spec `012` pattern: fetch status → dismiss + toast if terminal → else navigate. Keeps `Notifications.tsx` thin.

### 5. Test matrix extension
Add rows to E2E suite:

| Scenario | Assert |
|----------|--------|
| Network bridge detail → View profile → back | URL `/network`, node sheet visible |
| Profile shared bridge tap | No Make plan / View profile; viewer avatar visible |
| Profile → new gum → back | URL `/profile/:username` |
| Stale `plan_expired` tap | Toast + notification dismissed |

### 6. What not to do
- Do not remove network CTAs from `BridgeDetailSheet` network variant (spec `013` FR-3).
- Do not replace all `navigate(-1)` with `returnTo` — history back remains valid when stack is reliable (spec `007`).
- Do not add URL query params for every flow in this spec — increases scope and SEO/share surface; defer C-05 unless product requires refresh-safe deep links.

---

## Dependencies
- Spec `013` (profile bridge detail — regression baseline)
- Spec `007` / `010` (profile back navigation)
- Spec `012` (notification stale tap pattern)
- `src/lib/notificationRouting.ts`, `BridgeDetailSheet`, `SharedBridgesSection`, `Feed.tsx`, `PostDetailSheet.tsx`

## Assumptions
- P1 fixes (C-01–C-04) can ship incrementally behind this single spec without splitting, as long as each has tests before `<promise>DONE</promise>`.
- C-04 stretch (restore post detail) may be deferred without blocking completion if minimum `returnTo` is shipped and documented.
- Module-level caches (C-06) are lower priority than navigation context bugs.

---

## Completion Signal

### Implementation Checklist
- [ ] Audit table and entry-point matrix added to `DEVDOC.md`
- [ ] C-01: Bridge detail View profile `returnTo` / `selectUserId`
- [ ] C-02: Profile new-gum `returnTo`
- [ ] C-03: Extended stale gum-piece notification handling
- [ ] C-04: Feed post detail `returnTo` (and optional `restorePostId`)
- [ ] P2 items C-05–C-09 disposition recorded in `DEVDOC.md`
- [ ] `IMPLEMENTATION_PLAN.md` updated
- [ ] `docs/regression-matrix.md` session row added

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [ ] All existing unit tests pass
- [ ] All existing integration/E2E tests pass
- [ ] New tests for each implemented C-xx fix
- [ ] No lint errors
- [ ] `npm run quality` passes

#### Functional Verification
- [ ] C-01 verified: network bridge detail → profile → back
- [ ] C-02 verified: profile → new gum → back
- [ ] C-03 verified: stale notification types dismiss with toast
- [ ] Spec `013` profile bridge sheet still read-only with avatars
- [ ] Spec `010` feed/network profile back tests still pass

#### Visual Verification (if UI)
- [ ] No new layout regressions on 375px / 390px for touched flows

#### Console/Network Check (if web)
- [ ] No JavaScript console errors on audited flows
- [ ] No new failed network requests

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue (reference audit ID C-xx)
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`
