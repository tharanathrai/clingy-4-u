# Specification: Other-User Profile Back Navigation

## Status: COMPLETE

## Feature: Back Control on Other-User Profile

### Overview
When a user opens someone else's profile from the network graph, feed, post detail sheet, piece detail, or other in-app links, they land on `/profile/:username` with no way to return to where they came from except the bottom tab bar (which switches tabs rather than restoring prior context). This is a navigation gap: the other-user profile screen was laid out like a tab-root screen (`pageShellTab`, no header chrome) even though it is almost always reached as a **push** destination from another screen.

Own profile (`/profile/me`) correctly uses tab-bar navigation with header icon actions (graveyard, settings) and does not need a back control. Other-user profile must add a standard `BackHeader` so users can return to the screen they came from — matching push flows like piece detail, settings, and connection requests.

### User Stories
- As a user browsing the feed, I want a back control on another person's profile so I can return to the feed without switching tabs.
- As a user on the network graph who taps "View profile" from a node sheet, I want to go back to the network view with my prior context.
- As a user who opened a profile from a post comment, piece partner link, or add/connect flow, I want predictable back navigation instead of being stranded on a profile with only the tab bar.

---

## Functional Requirements

### FR-1: Back header on other-user profile
The other-user profile screen must show the app's standard back control at the top of the page.

**Acceptance Criteria:**
- [x] When viewing `/profile/:username` for a user other than the signed-in viewer, a `BackHeader` appears at the top of the content (above avatar/name).
- [x] When the viewer is redirected to `/profile/me` (own username), no back header is added there — existing `ProfileMeHeader` behavior is unchanged.
- [x] Back control uses the shared `BackHeader` pattern: `ArrowLeft` icon, label `back`, minimum 44×44px touch target, styling consistent with `DEVDOC.md` and other push screens.
- [x] Loading skeleton state for other-user profile includes space for the back header (no layout jump when content loads).

### FR-2: Back navigation behavior
Tapping back must return the user to their prior in-app context when possible.

**Acceptance Criteria:**
- [x] Tapping back uses browser/history back (`navigate(-1)` or equivalent) when there is a prior history entry within the app session.
- [x] When there is no usable history (e.g. direct URL open, refreshed page, or single history entry), back navigates to `/home` as a safe fallback — same pattern as piece detail.
- [x] Back from profile opened via feed returns to feed (via history).
- [x] Back from profile opened via network "View profile" returns to network (via history).
- [x] Back from profile opened via post detail sheet (author or commenter tap) returns to the feed with the post detail sheet restored if history supports it; at minimum, returns to feed without trapping the user on profile.
- [x] Back does not sign the user out or navigate to landing/auth screens unless that was the actual prior page.

### FR-3: Optional explicit return path (entry-point hardening)
Entry points that navigate to another user's profile should pass return context where history alone is unreliable.

**Acceptance Criteria:**
- [x] Network `onViewProfile` navigation may pass `location.state.returnTo` (e.g. `/network` with `selectUserId` when applicable) — implementation may use history-only back if verified sufficient; if `returnTo` is present, back prefers it over blind history fallback.
- [x] Feed author tap and post-detail profile taps do not require URL changes beyond existing `/profile/:username` route.
- [x] No regression to existing links (`PieceDetail` partner link, `AddScan`/`Connect` profile links, `BridgeDetailSheet` profile link) — all gain working back via FR-2.

### FR-4: Layout and regression safety
The addition must fit existing shell conventions without breaking tab-bar clearance or profile content.

**Acceptance Criteria:**
- [x] Other-user profile keeps `pageShellTab` and bottom tab bar visibility (unchanged from today).
- [x] Back header does not overlap avatar, display name, or "Add {name}" CTA on 375px and 390px widths.
- [x] Error and not-found states on other-user profile also show back (or equivalent escape) — not only the happy path.
- [x] Shared bridges section, gumball, category breakdown, and connection CTA behave exactly as before.

---

## Success Criteria

- Users who open another person's profile from feed, network, or post detail can return to the prior screen in one tap without using the tab bar.
- Back control is visually and behaviorally consistent with settings, graveyard, piece detail, and connection requests.
- Own profile (`/profile/me`) is unchanged.
- No new console errors or broken deep links on `/profile/:username`.
- Manual check on 375px and 390px: back header visible, tappable, and does not cause double scroll inside `.app-device-screen`.

---

## Root Cause (for implementers)

| Observation | Detail |
|---|---|
| Missing UI | `ProfileUser.tsx` renders profile content only — no `BackHeader`. |
| Shell mismatch | `DEVDOC.md` classifies `/profile/:username` as a tab-bar scroll page (`pageShellTab`), same as `/profile/me`, but it is reached as a push destination from many flows. |
| Navigation calls | Feed: `navigate(\`/profile/${username}\`)`. Network sheet: `navigate(\`/profile/${username}\`)`. Post detail: same. None pass `returnTo` state (unlike `PieceNew`). |
| Notifications | Notification taps do not open profiles directly today (`post_comment` / `post_reaction` go to `/feed`); users may reach profiles from feed afterward — covered by FR-2. |

---

## Dependencies
- `src/pages/ProfileUser.tsx` (primary change surface)
- `src/components/layout/BackHeader.tsx` (existing shared component)
- Entry navigators: `src/pages/Feed.tsx`, `src/components/feed/PostDetailSheet.tsx`, `src/pages/Network.tsx`, `src/pages/PieceDetail.tsx`, `src/components/network/BridgeDetailSheet.tsx`
- `DEVDOC.md` layout table (update after implementation)
- `DESIGN.md` / `DEVDOC.md` back-header standards

## Assumptions
- History-based back is sufficient for most in-app flows; explicit `returnTo` is optional hardening for network restore edge cases.
- Fallback destination when history is empty is `/home` (consistent with `PieceDetail.tsx`).
- Notifications screen itself does not need a new profile deep link in this spec — only that profiles opened after visiting notifications (via feed, etc.) have back navigation.

---

## Completion Signal

### Implementation Checklist
- [x] Add `BackHeader` to other-user profile happy path in `ProfileUser.tsx`
- [x] Implement back handler (history back with `/home` fallback)
- [x] Add back to loading skeleton and error/not-found states for other-user profile
- [x] Verify entry points from feed, network sheet, post detail, piece detail partner link
- [x] Update `DEVDOC.md` profile section to document back header on `/profile/:username`
- [x] Add or extend tests for back behavior where practical (component or navigation test)

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New tests added for new functionality
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Edge cases handled (no history, own-username redirect, profile not found)
- [x] Error handling in place

#### Visual Verification (if UI)
- [x] Desktop view looks correct
- [x] Mobile view looks correct
- [x] Design matches style guide

#### Console/Network Check (if web)
- [x] No JavaScript console errors
- [x] No failed network requests
- [x] No 4xx or 5xx errors

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`
