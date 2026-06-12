# Specification: Profile Bridge Detail Sheet Fix

## Status: COMPLETE

## Feature: Correct Bridge Detail Sheet on Profile Shared Bridges

### Overview
When a user views another person's profile and taps a shared bridge in the "your bridges together" section, a bridge detail sheet opens. Today that sheet incorrectly shows **Make plan** and **View profile** actions — actions meant for the network graph flow, not for a profile the user is already viewing. The sheet also fails to show the signed-in viewer's profile photo on the "You" participant card (a blank placeholder circle is rendered instead).

This spec fixes both issues so the profile bridge-detail experience matches DESIGN.md (activity, category, date, both participants) without redundant navigation CTAs, and so both participants display their avatars correctly.

### User Stories
- As a user browsing someone's profile, when I tap a shared bridge I want to see bridge details and both participants' faces so the memory feels personal and complete.
- As a user on another person's profile, I do not want **View profile** on a bridge sheet when I am already on that profile.
- As a user on another person's profile, I do not want **Make plan** on a bridge detail sheet — plan creation belongs on the profile or pocket flows, not on a historical bridge record.

---

## Functional Requirements

### FR-1: Show viewer avatar on bridge detail sheet
The "You" participant card in `BridgeDetailSheet` must display the signed-in user's avatar (or initials fallback), matching how the other participant is rendered.

**Acceptance Criteria:**
- [x] When the viewer has an `avatar_url`, the "You" card shows their circular avatar (sized consistently with the other participant, using existing `withAvatarSize` helper).
- [x] When the viewer has no avatar, the "You" card shows an initials fallback (first letter of display name), not a blank colored circle.
- [x] Fix applies in both entry points: network graph bridge tap and profile shared-bridge tap.
- [x] No layout shift or overlap on 375px and 390px widths.

### FR-2: Context-appropriate actions on profile-opened bridge detail
When `BridgeDetailSheet` is opened from the profile shared-bridges list (`BridgeListItem` on `/profile/:username`), the sheet must not show **Make plan** or **View profile** action buttons.

**Acceptance Criteria:**
- [x] Tapping a bridge on another user's profile opens a sheet with bridge title, category chip, humanized date, and both participant cards only — no bottom CTA row.
- [x] Close control (X) remains available and dismisses the sheet.
- [x] Profile page content behind the sheet is unchanged; closing returns to the same scroll position on the profile.
- [x] Empty shared-bridges state and "New gum" CTA on profile are unchanged.

### FR-3: Preserve network graph bridge detail actions
When `BridgeDetailSheet` is opened from the network graph (bridge tap after node selection), existing **Make plan** and **View profile** shortcuts remain.

**Acceptance Criteria:**
- [x] Network graph → select node → tap bridge → sheet still shows **Make plan** and **View profile** with current navigation state (`returnTo: '/network'`, `selectUserId`).
- [x] **Make plan** and **View profile** links continue to work; no regression to network return context (spec 007 / 010).
- [x] Viewer avatar fix from FR-1 also appears in this flow.

### FR-4: Implementation boundary
Changes are scoped to bridge detail presentation and context wiring — no changes to bridge data model, RLS, or profile fetch logic beyond what is needed to resolve the viewer's display name and avatar.

**Acceptance Criteria:**
- [x] `BridgeDetailSheet` accepts an explicit context or prop (e.g. `variant: 'network' | 'profile'`) so profile vs network behavior is unambiguous.
- [x] `BridgeListItem` passes profile context; `Network.tsx` passes network context (or relies on default).
- [x] Viewer user data is sourced from existing hooks/queries (e.g. `useAuth` + profile lookup) without duplicate fetches per sheet open where avoidable.

---

## Success Criteria

- Users tapping a shared bridge on a profile see a read-only bridge memory sheet with both avatars visible — no confusing duplicate profile/plan actions.
- Users tapping a bridge on the network graph retain quick shortcuts to plan and profile.
- Zero new console errors or failed avatar image requests when opening bridge detail from either entry point.
- Manual verification on 375px and 390px for both flows.

---

## Root Cause (for implementers)

| Observation | Detail |
|---|---|
| Wrong CTAs | `BridgeDetailSheet` is shared between `Network.tsx` and `BridgeListItem.tsx` but always renders **Make plan** / **View profile** — appropriate for network, redundant on profile. |
| Missing viewer avatar | "You" card hardcodes `<div className="mb-2 h-12 w-12 rounded-full bg-accent/30" />` with no `avatar_url` or initials logic (`BridgeDetailSheet.tsx` ~line 60). |
| Design intent | `DESIGN.md` §10 bridge detail sheet: title, category, date, both participants — no CTA row for profile context. |
| Profile entry | `SharedBridgesSection` → `BridgeListItem` → `BridgeDetailSheet` with `otherUser={profile}`. |

---

## Dependencies
- Existing `BridgeDetailSheet`, `BridgeListItem`, `SharedBridgesSection`, `Network.tsx`
- `useProfile` / viewer profile data for avatar resolution
- `withAvatarSize` utility (`src/utils/avatar.ts`)
- Spec 007 / 010 network profile return navigation (must not regress)

## Assumptions
- Profile-context bridge detail is informational only; users who want to make a new plan use profile-level or pocket CTAs elsewhere.
- Network-context CTAs remain desirable and are in scope to keep, not remove globally.
- Viewer profile is always loadable when the user is authenticated on profile or network screens.

---

## Completion Signal

### Implementation Checklist
- [x] Resolve viewer avatar in `BridgeDetailSheet` (image or initials fallback for "You" card)
- [x] Add context prop to `BridgeDetailSheet`; hide CTA row when `variant === 'profile'`
- [x] Wire `BridgeListItem` to pass profile context
- [x] Verify `Network.tsx` still passes network context (default or explicit)
- [x] Update `DEVDOC.md` profile and network sections if behavior description changes

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New or updated tests for profile-context sheet (no CTA row) and viewer avatar rendering
- [x] No lint errors

#### Functional Verification
- [x] FR-1: Viewer avatar visible on profile-opened bridge detail
- [x] FR-1: Viewer avatar visible on network-opened bridge detail
- [x] FR-2: Profile shared bridge tap — no Make plan / View profile buttons
- [x] FR-3: Network bridge tap — Make plan / View profile still present and navigable
- [x] Edge cases: viewer or other user without avatar shows initials; sheet closes cleanly

#### Visual Verification (if UI)
- [x] Desktop view looks correct
- [x] Mobile view looks correct (375px, 390px)
- [x] Participant cards align with DESIGN.md bridge detail pattern

#### Console/Network Check (if web)
- [x] No JavaScript console errors
- [x] No failed network requests
- [x] No 4xx or 5xx errors on avatar URLs

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
