# Specification: Feed Profile Navigation

## Status: COMPLETE

## Feature: Feed-Safe Profile Taps and Context-Preserving Back

### Overview
On the feed, two navigation behaviors undermine UX credibility:

1. **Own-profile dead end:** Tapping the author avatar on your own post navigates to `/profile/:username`, which immediately redirects to `/profile/me`. You are already one tab away from your profile; the tap adds no value and feels broken.
2. **Lost post-detail context:** Opening someone's profile from the post detail sheet (author, commenter, or "with {name}" link) and tapping back lands on the bare feed list. The post detail overlay does not reopen even though `restorePostId` is already passed in `location.state` from `PostDetailSheet` — spec `014` C-04 shipped the minimum (`returnTo: '/feed'`) but deferred overlay restoration.

This spec closes C-04 stretch, blocks self-profile taps on feed surfaces, and adds a focused feed navigation audit so similar deep-state bugs do not recur.

### User Stories
- As a user reading my own post on the feed, I do not want tapping my avatar to navigate me to my profile — I use the Profile tab for that.
- As a user reading comments on a post, when I tap a commenter's name and then tap back, I want to return to that same post detail sheet — not lose my place on the feed.
- As a user who opened a profile from the feed list (no post detail open), I want back to return to the feed at my scroll position (existing behavior; must not regress).
- As a developer, I want feed profile navigation centralized so `returnTo` and `restorePostId` cannot drift between `Feed.tsx` and `PostDetailSheet.tsx`.

---

## Feed Contextual State Audit (Supplement to Spec 014)

Spec `014` catalogued cross-app deep-state risks. This table scopes **feed-specific** findings and their disposition in this spec.

| ID | Finding | Location | User impact | Fix in this spec |
|----|---------|----------|-------------|------------------|
| **F-01** | Feed card author tap always navigates, including when author is the viewer | `Feed.tsx` `onAuthorPress` | Tap own avatar → redirect dance to `/profile/me`; no value | Omit `onAuthorPress` when `post.author.id === viewerId` |
| **F-02** | Post detail sheet omits `onAuthorPress` for other users | `PostDetailSheet.tsx` | Author row in post detail is non-interactive while commenters are tappable — inconsistent | Wire `onAuthorPress` via `navigateToProfile` for non-self authors only |
| **F-03** | `restorePostId` passed to profile but never consumed on return | `PostDetailSheet.tsx` → `ProfileUser.tsx` → `Feed.tsx` | Post detail → profile → back → bare feed (C-04 stretch deferred) | Forward `restorePostId` on profile back; Feed reads state and reopens sheet |
| **F-04** | Feed list author tap bypasses `navigateToProfile` / `feedProfileReturnState` | `Feed.tsx` | Inconsistent with hardened post-detail taps; `returnTo` missing if history unreliable | Use `navigateToProfile` with `returnTo: '/feed'` for other-user taps |
| **F-05** | Post detail overlay may remain in React state while route changes | `Feed.tsx` | Unmount on `/profile` clears `selectedPostId`; acceptable once F-03 restores via state | No separate fix — F-03 addresses remount restore |

### Patterns to avoid (from spec 013 / 014)

| Pattern | Feed example | Prevention |
|---------|--------------|------------|
| State passed but not round-tripped | `restorePostId` dropped in `ProfileUser.handleBack` | When using `returnTo`, forward all overlay-restore keys in navigation state |
| Implicit "always navigable" avatars | Own post author row | Gate `onAuthorPress` on viewer ≠ author |
| Copy-paste `navigate()` calls | `Feed.tsx` raw template string | Use `navigateToProfile` + `feedProfileReturnState` |

---

## Functional Requirements

### FR-1: Disable own-profile navigation from feed surfaces
The signed-in viewer must not be able to open their own profile by tapping their avatar or name on feed UI.

**Acceptance Criteria:**
- [x] On the feed list, when `post.author.id` matches the signed-in user, the author row (`FeedPostCard` header) is not navigable — `onAuthorPress` is omitted; button appears disabled (existing `disabled={!onAuthorPress}` styling).
- [x] In `PostDetailSheet`, when the post author is the viewer, `onAuthorPress` is omitted on the embedded `FeedPostCard`.
- [x] Comment rows for the viewer (`username === 'me'` or `user.id === viewerId`) remain non-navigable (existing behavior preserved).
- [x] Other-user author, commenter, and "with {name}" taps still navigate to `/profile/:username`.
- [x] Tapping own avatar does not change route, does not flash `/profile/me`, and does not add a history entry.

### FR-2: Restore post detail overlay after profile back (C-04 stretch)
When the user opens another person's profile from an open post detail sheet, back must return to the feed **with that post detail sheet reopened**.

**Acceptance Criteria:**
- [x] `PostDetailSheet` profile taps continue to pass `feedProfileReturnState(postId)` (`returnTo: '/feed'`, `restorePostId`).
- [x] `ProfileUser.handleBack`, when navigating via `returnTo`, forwards `restorePostId` (and `selectUserId` when present) in the navigation state to the return route.
- [x] `Feed.tsx` reads `restorePostId` from `location.state` on mount (via `useLocation`), opens `PostDetailSheet` for that post, then clears `restorePostId` from state (replace navigation) so refresh does not reopen the sheet.
- [x] Back from profile opened via post detail commenter tap → feed URL with post detail visible for the same `postId`.
- [x] Back from profile opened via post detail "with {name}" tap → same restoration behavior.
- [x] Explicit close (X) on post detail after restore still works; hardware back on restored sheet closes sheet per existing `pushState` / `popstate` pattern.

### FR-3: Harden feed list profile taps (other users)
Feed list author taps for **other** users use the shared navigation helper for consistency with post detail.

**Acceptance Criteria:**
- [x] `Feed.tsx` uses `navigateToProfile` (or equivalent) with `returnTo: '/feed'` for other-user author taps.
- [x] Feed list → other-user profile → back returns to `/feed` (via `returnTo` or history).
- [x] Feed scroll position restores via existing `useScrollRestore('scroll:/feed')` — no regression.

### FR-4: Post detail author tap parity
Post detail must allow navigating to the **other** post author when the author is not the viewer.

**Acceptance Criteria:**
- [x] `PostDetailSheet` passes `onAuthorPress` to `FeedPostCard` when `post.author.id !== viewerId`, using `navigateToProfile` + `feedProfileReturnState(postId)`.
- [x] Self-authored posts in post detail: author row not navigable (FR-1).

### FR-5: Regression safety net
Changes must not break navigation hardened in prior specs.

**Acceptance Criteria:**
- [x] Spec `007` / `010` E2E: feed author tap → other-user profile → back to feed still passes.
- [x] Spec `010` network `returnTo` + `selectUserId` back path unchanged.
- [x] Spec `013` profile bridge detail sheet unchanged.
- [x] Spec `014` C-01–C-03 fixes unchanged.
- [x] `DEVDOC.md` Navigation context: mark C-04 stretch as **shipped**; update matrix row for Feed / post detail.
- [x] Unit tests for `ProfileUser` back with `restorePostId` forwarding; Feed restore on mount.
- [x] E2E or Playwright test: post detail → commenter profile → back → post detail visible.

---

## Success Criteria

- Zero navigations to own profile from feed avatar/name taps.
- Post detail → profile → back restores the same post overlay in one back tap.
- Feed list → other-user profile → back returns to feed without trapping the user.
- Documented feed findings (F-01–F-05) disposition recorded in `DEVDOC.md`.
- All existing profile-back and navigation-context tests pass; new tests cover F-01 and F-03.

---

## Root Cause (for implementers)

| Observation | Detail |
|---|---|
| Own-profile tap | `Feed.tsx` line ~183: unconditional `onAuthorPress={() => navigate(\`/profile/${post.author.username}\`)}` — no viewer check. |
| Missing post detail restore | `feedProfileReturnState(postId)` sets `restorePostId` in `PostDetailSheet`; `ProfileUser.handleBack` navigates to `returnTo` without forwarding `restorePostId`; `Feed.tsx` never reads `location.state`. |
| Post detail author | `PostDetailSheet` renders `FeedPostCard` without `onAuthorPress` — only commenters and other participant wired. |
| Prior deferral | Spec `014` C-04 stretch explicitly deferred in `DEVDOC.md` and `IMPLEMENTATION_PLAN.md`. |

---

## Recommended Fix Approaches (Non-Regressive)

### 1. Viewer gate helper
Add a small predicate or inline check: `canNavigateToProfile(viewerId, targetUserId)` → boolean. Use in `Feed.tsx` and `PostDetailSheet.tsx` before passing `onAuthorPress`.

### 2. Round-trip `restorePostId`
Extend `ProfileLocationState` / `AppLocationState` usage in `ProfileUser.tsx`:

```ts
navigate(state.returnTo, {
  state: {
    ...(state.selectUserId ? { selectUserId: state.selectUserId } : {}),
    ...(state.restorePostId ? { restorePostId: state.restorePostId } : {}),
  },
})
```

### 3. Feed mount restore
In `Feed.tsx`, `useEffect` on `location.state?.restorePostId`: call `openPostDetail(restorePostId)`, then `navigate('.', { replace: true, state: {} })` to consume the flag.

### 4. Centralize profile navigation
Replace raw `navigate(\`/profile/...\`)` in feed files with `navigateToProfile(navigate, { username, returnTo: '/feed', restorePostId })`.

### 5. What not to do
- Do not remove `BackHeader` from other-user profiles (spec `007`).
- Do not navigate to `/profile/me` on own avatar tap — omit handler instead.
- Do not use URL query params for `restorePostId` in this spec (defer per C-05).
- Do not close post detail before navigate — remount + state restore is sufficient and avoids double animation.

---

## Dependencies
- Spec `007` / `010` (profile back navigation baseline)
- Spec `014` C-04 (`feedProfileReturnState`, deferred stretch)
- `src/lib/navigationContext.ts`, `src/pages/Feed.tsx`, `src/pages/ProfileUser.tsx`, `src/components/feed/PostDetailSheet.tsx`, `src/components/feed/FeedPostCard.tsx`
- `useScrollRestore` for feed scroll (must not regress)

## Assumptions
- Viewer id is available via `useAuth()` on feed screens.
- `restorePostId` refers to a post still present in the feed query; if missing, Feed opens sheet and `usePost` handles loading/error gracefully.
- Own-profile navigation from the Profile tab remains the intended path to `/profile/me`.
- "With {name}" participant is always another user in bridge posts; no separate self-gate needed unless audit finds otherwise during implementation.

---

## Completion Signal

### Implementation Checklist
- [x] FR-1: Gate own-profile taps on feed list and post detail author row
- [x] FR-2: Forward `restorePostId` in `ProfileUser.handleBack`; consume in `Feed.tsx`
- [x] FR-3: Use `navigateToProfile` for feed list other-user author taps
- [x] FR-4: Wire post detail `onAuthorPress` for non-self authors
- [x] Update `DEVDOC.md` (C-04 stretch shipped; F-01–F-05 disposition)
- [x] Update `IMPLEMENTATION_PLAN.md` and `docs/regression-matrix.md` session row

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration/E2E tests pass
- [x] New tests for own-profile tap gate and `restorePostId` round-trip
- [x] No lint errors
- [x] `npm run quality` passes

#### Functional Verification
- [x] FR-1: Own post author avatar not navigable on feed list and post detail
- [x] FR-2: Post detail → commenter/other participant profile → back reopens same post detail
- [x] FR-3: Feed list → other-user profile → back to feed with scroll restored
- [x] FR-4: Post detail other-user author tap navigates with restore context
- [x] Spec `010` profile-back E2E still passes

#### Visual Verification (if UI)
- [x] Own-profile author row looks intentionally non-interactive (disabled cursor), not broken
- [x] Restored post detail sheet matches prior open state on 375px / 390px
- [x] No layout jump when sheet reopens after profile back

#### Console/Network Check (if web)
- [x] No JavaScript console errors on feed profile flows
- [x] No failed network requests on restored post detail

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue (reference F-xx or FR-x)
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
