# Specification: Seamless Data Refresh

## Status: COMPLETE

## Feature: Race-Free Cache & Realtime Synchronization

### Overview
Users report that data refresh feels glitchy: screens flash loading skeletons when returning from another tab or route, realtime updates sometimes lag behind or briefly show stale state, and occasional race conditions force manual page reloads to see the correct UI. Prior work (BACKLOG item 4) reduced auth remount flashes, but inconsistencies remain across hooks, guards, and realtime handlers.

This spec audits every data-fetching and invalidation path documented in `DEVDOC.md`, `PRD.md`, `.cursor/rules`, and `BACKLOG.md`, then standardizes how React Query caches, Supabase realtime events, mutations, and auth/profile gating interact so the app feels instant and trustworthy on every screen and journey.

**In scope:** All client-side data hooks, `AuthGuard` / `useProfileReady` gating, centralized invalidation (`src/lib/invalidate.ts`), realtime helper (`src/lib/realtime.ts`), and page-level loading/error/retry patterns for flows listed in `DEVDOC.md` Flow Status.

**Out of scope:** Edge function deduplication logic (server-side confirmation races), new features, UI layout consistency (spec 003/004), email/cron flows.

### User Stories
- As a user switching between tab screens, I want previously loaded content to appear instantly so the app never feels like it is reloading.
- As a user who accepts a connection or responds to a gum piece, I want every related screen (pocket, network graph, notifications, piece detail) to update without manual refresh.
- As a user on the confirmation screen with another person, I want OTP and confirm state to sync in real time without flicker or duplicate ceremony triggers.
- As a new user finishing onboarding, I want `AuthGuard` to route me to `/add` immediately without a blocking "Loading your account..." flash.
- As a developer, I want one documented refresh policy so future hooks do not reintroduce invalidation races or skeleton flashes.

---

## Known Issues (Pre-Implementation Audit)

| Issue | Location | Current state |
|-------|----------|---------------|
| Policy conflict | `.cursor/rules` vs hooks | Rules require realtime → `setQueryData` only; `useFeed`, `useGumPieces`, `useNetworkGraph`, `usePost`, `PieceDetail` invalidate on realtime → full refetch + flicker |
| Loading conflation | All data hooks | `loading: authLoading \|\| isLoading` treats background refetch like first load → skeleton flashes on cached screens |
| Auth guard flash | `AuthGuard`, `useProfileReady` | `staleTime: 0` on profile-ready; guard blocks entire app on every refetch with "Loading your account..." |
| Feed refetch storm | `useFeed` | Any posts/reactions/comments change invalidates entire feed (DEVDOC known issue #4) |
| Network retry reset | `Network.tsx` | Retry sets loading state → brief graph wipe despite cache (DEVDOC known issue #5) |
| Piece detail aggressive refetch | `PieceDetail.tsx` | `staleTime: 0` + realtime invalidation; status redirect effect can race with in-flight fetch |
| Confirmation focus refetch | `useConfirmationSession` | `staleTime: 0` + `refetchOnWindowFocus: true` alongside realtime `setQueryData` → duplicate fetch / bridge-formed callback risk |
| Notification enrich race | `useNotifications` INSERT handler | Async `enrichNotifications` then `setQueryData`; concurrent invalidation or duplicate INSERT can reorder or duplicate rows |
| Scattered invalidation | Page files | Some cross-flow invalidations live in pages instead of `invalidate.ts` |
| Auth sync loading | `useAuth` `onAuthStateChange` | Calls `syncUser()` (network) on every token event; can briefly toggle loading on tab focus if not guarded |
| Connections count key | `Home.tsx` | Ad-hoc `['connections-count', userId]` key; not in `queryKeys.ts`; not invalidated on connection accept |
| No debounce on burst invalidations | Realtime hooks | Rapid postgres events can queue overlapping refetches for the same query key |

---

## Functional Requirements

### FR-1: Refresh policy audit and documentation
Before changing behavior, confirm the audit table against live code and extend it for any missed hooks or pages.

**Acceptance Criteria:**
- [x] Audit covers all 10 custom data hooks in `DEVDOC.md` Architecture §2 plus `useProfileReady`, inline page queries (`Home` connections count, `PieceDetail` inline query), and `useAuth`.
- [x] Each audited surface is classified: **cache-first** (show cached data during background refresh), **patch-on-realtime** (`setQueryData`), or **invalidate-on-mutation** (with debounce/coalescing).
- [x] A **Refresh & Cache Policy** section is added to `DEVDOC.md` Architecture decisions describing the chosen patterns (replacing contradictory notes where needed).
- [x] Deviations from `.cursor/rules` performance guidance are either fixed or documented with explicit rationale in `DEVDOC.md`.

### FR-2: Stale-while-revalidate — no skeleton flash on cached data
When React Query already has data for a query key, navigation, tab switch, or background invalidation must not replace the UI with a full-page skeleton.

**Acceptance Criteria:**
- [x] All list/detail hooks expose `loading` as true only on **initial** load (`isPending` with no cached data), not during background `isFetching`.
- [x] Tab roots (`/home`, `/feed`, `/notifications`, `/network`, `/profile/me`) render cached content immediately when revisiting within the same session.
- [x] Optional subtle background refresh indicator is acceptable; full skeleton replacement is not.
- [x] `AuthGuard` does not show "Checking your session..." or "Loading your account..." when auth is already initialized and profile-ready has a cached value — only on true first load or explicit sign-out/sign-in transition.
- [x] `useProfileReady` uses cache + imperative `markProfileReady` after onboarding; refetch is background-only and does not block guarded routes.

### FR-3: Realtime updates without disruptive refetch
Realtime postgres events should update the UI directly or via coalesced invalidation — never cause visible flicker or stale-then-fresh oscillation.

**Acceptance Criteria:**
- [x] `useNotifications` continues INSERT/UPDATE patch pattern; INSERT enrichment races are serialized (no duplicate rows, no lost updates when events arrive in quick succession).
- [x] `useConfirmationSession` relies on realtime `setQueryData` as source of truth; redundant `refetchOnWindowFocus` / `staleTime: 0` refetch loops removed unless required for expiry edge case.
- [x] `onBridgeFormed` fires exactly once per session deletion — not on mount, refetch, or duplicate DELETE events.
- [x] High-churn invalidation hooks (`useFeed`, `useGumPieces`, `useNetworkGraph`, `usePost`, `PieceDetail`) either patch cache where feasible OR use debounced/coalesced `invalidateQueries` (e.g. single refetch per key per animation frame or 300ms window) so burst events do not stack refetches.
- [x] `subscribePostgresChannel` cleanup remains correct; no new StrictMode double-subscribe regressions.

### FR-4: Mutation and realtime coordination
Optimistic mutations and realtime handlers must not fight each other.

**Acceptance Criteria:**
- [x] Notification mark-read / dismiss optimistic updates are not overwritten by a stale realtime UPDATE or a concurrent refetch.
- [x] Feed reaction optimistic toggle (`useMutation` + `setQueryData`) is not rolled back by a realtime-triggered full refetch arriving before mutation settles.
- [x] Connection accept/reject calls `invalidateConnectionFlow` (or successor helper) once; related caches (network graph, pending count, connections count, profile shared bridges) update without duplicate invalidation from both mutation handler and realtime.
- [x] Gum piece respond/create mutations invalidate pocket + piece detail + notifications in a defined order documented in `invalidate.ts`.

### FR-5: Centralized cross-flow invalidation
All cross-screen cache updates go through `src/lib/invalidate.ts` and `src/lib/queryKeys.ts`.

**Acceptance Criteria:**
- [x] `Home.tsx` connections count uses a key from `queryKeys.ts` and is invalidated in `invalidateConnectionFlow`.
- [x] No new ad-hoc query key strings in page files for data shared across flows.
- [x] `invalidate.ts` exports helpers for gum-piece, feed, profile, and confirmation flows where pages currently inline `queryClient.invalidateQueries`.
- [x] Call sites in `ConnectionRequests`, `ConnectionRequestSheet`, `Notifications`, `PieceNew`, `PieceDetail`, and profile edit flows use centralized helpers.

### FR-6: Error retry without destructive reset
Manual retry and error recovery must refresh data without wiping visible UI or resetting interactive state (graph selection, scroll position).

**Acceptance Criteria:**
- [x] Network graph retry refetches data without forcing `NetworkGraph` into a loading-only render when cached nodes/edges exist (fixes DEVDOC known issue #5).
- [x] Home, Feed, Notifications, PieceDetail, Profile error "Try again" buttons call `refetch` / invalidation without navigating away or clearing unrelated UI state.
- [x] Retry on error does not set `loading: true` at the page level when cached data is still valid to display alongside an error banner.

### FR-7: Auth lifecycle stability
Auth state changes must not cause unnecessary loading cascades across the app.

**Acceptance Criteria:**
- [x] `useAuth` does not set `loading: true` on `TOKEN_REFRESHED` or other non-sign-in/out events when user identity is unchanged.
- [x] Tab/window focus does not trigger app-wide "Checking your session..." when session is valid (aligns with `refetchOnWindowFocus: false` default).
- [x] Sign-out clears React Query caches for the previous user; sign-in does not show previous user's cached data.

### FR-8: Automated regression coverage
Refresh behavior must be testable and guarded against regressions.

**Acceptance Criteria:**
- [x] Unit tests cover: profile-ready cache + `markProfileReady` without guard flash; debounce/coalesce helper if introduced; notification INSERT race serialization; confirmation `onBridgeFormed` once-only semantics.
- [x] Existing `realtime.test.ts`, `useProfileReady.test.ts`, and notification tests continue to pass.
- [x] At least one test asserts hooks return `loading: false` when cached data exists and a background refetch is in flight.
- [x] `npm run quality` passes.

---

## Success Criteria

- Zero full-page skeleton flashes when navigating between tab roots with warm cache in a manual QA pass (Home → Feed → Notifications → Network → Profile → Home).
- Connection accept updates network graph and request badge within 2 seconds without manual refresh (manual QA item 12 in `DEVDOC.md` remains passing).
- Confirmation OTP appears on second device without manual refresh; unwrap ceremony triggers once per bridge (manual QA items 2 and 11).
- Onboarding completion routes to `/add` without an intermediate "Loading your account..." full-screen block longer than 500ms.
- `DEVDOC.md` Known Issues #4 and #5 are resolved or explicitly superseded by the new Refresh & Cache Policy.
- No new JavaScript console errors or failed network requests during tab switching or realtime-heavy flows.

---

## Dependencies
- React Query setup: `src/main.tsx`, `src/lib/queryKeys.ts`, `src/lib/invalidate.ts`
- Realtime: `src/lib/realtime.ts`, `src/tests/realtime.test.ts`
- Auth & gating: `src/hooks/useAuth.ts`, `src/hooks/useProfileReady.ts`, `src/components/layout/AuthGuard.tsx`
- Data hooks: `useGumPieces`, `useFeed`, `useNotifications`, `usePost`, `useProfile`, `useBridges`, `useBridgesByPair`, `useNetworkGraph`, `useConfirmationSession`, `usePendingRequestCount`
- High-traffic pages: `Home`, `Feed`, `Notifications`, `Network`, `PieceDetail`, `PieceConfirm`, `ConnectionRequests`, `ProfileMe`, `Welcome`
- Project docs: `DEVDOC.md`, `PRD.md`, `.cursor/rules`, `BACKLOG.md`

## Assumptions
- Root cause is primarily client-side cache/loading semantics and invalidation coordination — not Supabase Realtime delivery reliability.
- Debounced invalidation is an acceptable interim for feeds/lists where full `setQueryData` patches are high-effort; patches are required only where `.cursor/rules` explicitly demands zero flicker (notifications, confirmation session).
- `staleTime: Infinity` remains correct for stable aggregates (gum pieces, network graph, profile) when paired with reliable invalidation and realtime coalescing.
- Two-user realtime QA (OTP sync, connection accept) requires manual verification; automated tests focus on hook/cache contracts.

---

## Completion Signal

### Implementation Checklist
- [x] Complete FR-1 audit; update `DEVDOC.md` with Refresh & Cache Policy
- [x] Implement FR-2 stale-while-revalidate across all data hooks and `AuthGuard`
- [x] Implement FR-3 realtime coalescing / patch fixes (notifications, confirmation, feed/gum/network/post)
- [x] Implement FR-4 mutation + realtime coordination
- [x] Implement FR-5 centralized `queryKeys` + `invalidate.ts` expansion
- [x] Implement FR-6 non-destructive error retry (Network + list pages)
- [x] Implement FR-7 auth lifecycle stability
- [x] Add FR-8 automated tests
- [x] Run `npm run quality`; update `DEVDOC.md` flow statuses and remove resolved known issues

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New tests added for new functionality
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Edge cases handled (burst realtime, concurrent mutation + invalidate, onboarding markProfileReady, sign-out cache clear)
- [x] Error handling in place

#### Visual Verification (if UI)
- [x] Desktop view looks correct
- [x] Mobile view looks correct
- [x] No skeleton flash on tab navigation with warm cache
- [x] Design matches style guide (loading states remain skeleton-on-first-load-only)

#### Console/Network Check (if web)
- [x] No JavaScript console errors
- [x] No failed network requests during tab switch / realtime flows
- [x] No 4xx or 5xx errors on happy path

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
