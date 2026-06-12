# Specification: Profile Back Navigation E2E

## Status: COMPLETE

## Feature: Playwright Proof for Other-User Profile Back Navigation

### Overview
Spec `007` implemented `BackHeader` on `/profile/:username` with history back, optional `returnTo`/`selectUserId` from network, and `/home` fallback. Users reported missing back controls; unit tests cover handler logic but CI lacked Playwright proof. This spec adds mocked Supabase E2E tests for the three critical navigation paths.

### User Stories
- As a developer, I want Playwright coverage so profile back navigation cannot regress silently.
- As a user opening a profile from the feed, I want back to return me to the feed (verified in CI).
- As a user opening a profile from network with restore context, I want back to return to network (verified in CI).

---

## Functional Requirements

### FR-1: Feed → profile → back
**Acceptance Criteria:**
- [x] Playwright test: feed author tap → `/profile/:username` shows `BackHeader`
- [x] Tapping back returns to `/feed`

### FR-2: Network `returnTo` → profile → back
**Acceptance Criteria:**
- [x] Playwright test: network node sheet → View profile → back returns to `/network`
- [x] `BackHeader` visible on other-user profile in this path

### FR-3: Cold open fallback
**Acceptance Criteria:**
- [x] Playwright test: direct `/profile/:username` (no prior history) → back navigates to `/home`

### FR-4: Own profile unchanged
**Acceptance Criteria:**
- [x] Playwright test: `/profile/me` does not show `BackHeader` back button

### FR-5: Documentation
**Acceptance Criteria:**
- [x] `DEVDOC.md` Profile flow notes Playwright back coverage
- [x] `history.md` updated

---

## Success Criteria

- Three navigation-path Playwright tests pass in CI (feed, network returnTo, cold fallback)
- Own-profile regression test passes
- `npm run quality` passes
- `npm run test:e2e` passes

---

## Dependencies
- Spec `007-profile-back-navigation` (implementation)
- `e2e/mocks.ts`, `e2e/smoke.spec.ts` patterns
- `src/pages/ProfileUser.tsx`, `src/pages/Network.tsx`, `src/pages/Feed.tsx`

## Assumptions
- Mocked Supabase REST (no live project) is sufficient for navigation proof
- Network sheet can be opened via `history.state.selectUserId` restore on reload

---

## Completion Signal

### Implementation Checklist
- [x] `e2e/profile-back.spec.ts` with feed, network returnTo, cold fallback, and own-profile tests
- [x] Mock helpers for connected friend + feed post in `e2e/mocks.ts`
- [x] `DEVDOC.md` and `history.md` updated
- [x] Completion log entry

### Testing Requirements

#### Code Quality
- [x] `npm run quality` passes
- [x] `npm run test:e2e` passes
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] `BackHeader` uses `name: 'back'` in each other-user path

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
