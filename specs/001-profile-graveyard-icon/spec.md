# Specification: Profile Graveyard Icon Button

## Status: COMPLETE

## Feature: Profile Graveyard Icon Button

### Overview
On the signed-in user's own profile page (`/profile/me`), graveyard access currently appears as a text link at the bottom of the page (`graveyard →`). This feature removes that inline link and replaces it with an icon button in the top-left of the profile header, opposite the existing settings icon button in the top-right. The change keeps graveyard navigation one tap away while decluttering the profile body and aligning header actions with the rest of the app.

### User Stories
- As a user viewing my profile, I want graveyard access in the page header so I can open expired plans without scrolling to the bottom of the page.
- As a user, I want profile header actions to use consistent icon buttons so navigation feels predictable and balanced.

---

## Functional Requirements

### FR-1: Remove bottom graveyard text link
The inline text link to the graveyard must be removed from the profile page body.

**Acceptance Criteria:**
- [ ] The `graveyard →` text link at the bottom of `/profile/me` is no longer rendered when the profile loads successfully.
- [ ] No other graveyard text link is introduced elsewhere on the profile body as a replacement.
- [ ] The bottom section that previously held only the graveyard link does not leave awkward empty spacing.

### FR-2: Add top-left graveyard icon button
A graveyard icon button must be added to the top-left of the profile header and navigate to the graveyard screen.

**Acceptance Criteria:**
- [ ] A tappable icon button appears in the top-left of the profile header on `/profile/me`.
- [ ] Tapping the button navigates to `/home/graveyard`.
- [ ] The button uses an icon that clearly represents the graveyard (expired plans), not generic navigation.
- [ ] The button includes an accessible name (e.g. `aria-label="Graveyard"`) because it is icon-only.
- [ ] The button meets the same minimum touch target size as the existing settings icon button (44×44px equivalent).

### FR-3: Header layout with settings on the right
The profile header must show graveyard on the left and settings on the right in a single balanced row.

**Acceptance Criteria:**
- [ ] The header row uses a left/right layout: graveyard icon on the left, settings icon on the right.
- [ ] Both buttons share the same visual treatment (size, shape, border, background, hover/active states) as the current settings icon button.
- [ ] The profile content below the header (avatar, name, gumball, etc.) remains unchanged in structure and spacing aside from removing the bottom link.

### FR-4: Consistent behavior across profile page states
The graveyard icon button must appear anywhere the settings icon button already appears on the own-profile page.

**Acceptance Criteria:**
- [ ] When the profile is loading, the header skeleton reflects two icon-button placeholders (left and right), not only the settings side.
- [ ] When the profile is missing or errored but the user is signed in, the graveyard icon button is still available in the top-left alongside settings.
- [ ] Other users' profile pages (`/profile/:username`) are unchanged — they do not gain a graveyard button.

### FR-5: Regression safety
Existing graveyard and profile flows must continue to work.

**Acceptance Criteria:**
- [ ] The graveyard page still loads and displays expired plans after navigating from the new icon button.
- [ ] The settings icon button on `/profile/me` still navigates to `/settings`.
- [ ] No new console errors or broken routes are introduced on the profile or graveyard pages.

---

## Success Criteria

- Users can reach the graveyard from their profile in one tap without scrolling.
- The profile page body no longer contains a graveyard text link.
- Header actions on `/profile/me` appear visually balanced with matching icon buttons on left and right.
- The change works on both mobile and desktop viewport widths used by the app.
- Accessibility tools can identify the graveyard control by name.

---

## Dependencies
- Own profile page at `/profile/me` (`ProfileMe`)
- Existing graveyard route at `/home/graveyard`
- Existing settings icon button pattern on the profile header

## Assumptions
- Scope is limited to the signed-in user's own profile page only.
- The graveyard destination and graveyard page UI remain unchanged.
- An appropriate graveyard-themed icon from the project's existing icon set will be chosen to match the settings button style.
- No badge or count indicator is required on the graveyard icon unless graveyard items exist (out of scope for this change).

---

## Completion Signal

### Implementation Checklist
- [ ] Remove the bottom `graveyard →` link from `ProfileMe`
- [ ] Add a top-left graveyard icon button linking to `/home/graveyard`
- [ ] Update the profile header row to `justify-between` with graveyard left and settings right
- [ ] Match styling and interaction states to the existing settings icon button
- [ ] Update loading and error/missing-profile header states to include both icon buttons
- [ ] Add or update tests covering graveyard navigation from the profile header

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] New tests added for new functionality
- [ ] No lint errors

#### Functional Verification
- [ ] All acceptance criteria verified
- [ ] Edge cases handled (loading, missing profile, signed-in user)
- [ ] Error handling in place

#### Visual Verification (if UI)
- [ ] Desktop view looks correct
- [ ] Mobile view looks correct
- [ ] Design matches style guide (icon button matches settings button; header is balanced)

#### Console/Network Check (if web)
- [ ] No JavaScript console errors
- [ ] No failed network requests
- [ ] No 4xx or 5xx errors

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
