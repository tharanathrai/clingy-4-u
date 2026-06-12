# Specification: Notifications Icon Button & Pointer Cursors

## Status: COMPLETE

## Feature: Notifications Header Icon & Interactive Cursor Affordance

### Overview
The notifications screen (`/notifications`) currently shows a text control ("Mark all as read") beside the page title when unread items exist. This feature replaces that text link with an icon-only button that matches existing header icon patterns (e.g. profile graveyard/settings). Separately, interactive controls across the app do not consistently show a pointer cursor on hover when the app is viewed in a mobile viewport on desktop (browser responsive/device emulation with a mouse). That makes buttons, links, and tappable rows feel non-interactive during development and desktop testing. This spec delivers the icon swap and establishes consistent hover cursor affordance for all primary interactive elements.

### User Stories
- As a user with unread notifications, I want a compact icon control to mark everything read so the header stays clean and aligned with other screens.
- As a user testing or using the app in a mobile-sized viewport on desktop, I want clickable elements to show a pointer cursor on hover so I can tell what is interactive before I tap or click.

---

## Functional Requirements

### FR-1: Replace mark-all-read text with icon button
The text control beside the notifications page title must become an icon-only button with the same behavior as today.

**Acceptance Criteria:**
- [x] When `unreadCount > 0`, the notifications header shows an icon button instead of the "Mark all as read" text link.
- [x] When `unreadCount === 0`, no mark-all control is shown (unchanged behavior).
- [x] Tapping/clicking the icon button calls the existing `markAllAsRead` action and marks all notifications read without navigation.
- [x] The button includes an accessible name via `aria-label` (e.g. "Mark all as read") because it is icon-only.
- [x] The button meets the project's 44×44px minimum touch target (`min-h-11 min-w-11` or equivalent).
- [x] Visual treatment matches existing header icon buttons: rounded-full, `border border-white/10`, `bg-surface`, icon at `size={18}` / `strokeWidth={1.75}`, hover/active states consistent with `ProfileMeHeader` icon buttons.
- [x] Icon choice clearly communicates "mark all read" (e.g. double-check or mail-open style from the existing Lucide set — not a generic menu or settings icon).

### FR-2: Header layout on notifications screen
The notifications title row must remain balanced after the control change.

**Acceptance Criteria:**
- [x] Page title remains sentence-case `notifications` on the left.
- [x] Mark-all icon button sits on the right of the title row, vertically aligned with the title.
- [x] No layout shift or awkward wrapping at 375px and 390px widths when the button appears.
- [x] Loading, error, empty, and populated notification list states are unchanged aside from the header control swap.

### FR-3: Pointer cursor on interactive elements (mobile viewport + desktop pointer)
When the app is viewed with a fine pointer (mouse/trackpad) — including mobile viewport emulation in desktop browsers — interactive affordances must show the appropriate cursor on hover.

**Acceptance Criteria:**
- [x] Native `<button>` elements (enabled) show `cursor: pointer` on hover.
- [x] `<a href="...">` links and React Router `<Link>` navigations show `cursor: pointer` on hover.
- [x] Icon-only header/action buttons (profile, network, notifications mark-all, back header, sheet close controls, etc.) show `cursor: pointer` on hover.
- [x] Tappable list/card rows implemented as buttons (e.g. notification items, feed post headers, connection rows) show `cursor: pointer` on hover.
- [x] Bottom tab bar navigation links show `cursor: pointer` on hover.
- [x] Disabled controls retain `cursor: not-allowed` (or equivalent) and are not overridden to pointer.
- [x] Text inputs, textareas, and other text-entry fields keep the default text cursor — not pointer.
- [x] Solution applies app-wide via a shared pattern (base stylesheet and/or shared interactive class) rather than one-off fixes on a single screen — no new screen should ship without pointer affordance on its interactive controls.
- [x] Cursor rules use `@media (hover: hover) and (pointer: fine)` (or equivalent) so real touch-only devices are unaffected.

### FR-4: Regression safety
Existing notification and navigation flows must continue to work.

**Acceptance Criteria:**
- [x] Individual notification tap behavior, connection request sheet, pagination, and empty/error states on `/notifications` are unchanged.
- [x] `markAllAsRead` still updates unread count and notification read state (including tab badge) without requiring a full page reload.
- [x] No new console errors on notifications or other primary tab screens after cursor changes.
- [x] Visual regression: disabled buttons and non-interactive text still look correct (no accidental pointer on static copy).

---

## Success Criteria

- Notifications header uses an icon button for mark-all-read when unread items exist; no text link remains in that position.
- Users with screen readers can identify the mark-all control by its accessible name.
- When hovering with a mouse in mobile viewport emulation (375×667 and 390×844), all primary interactive controls show a pointer cursor; disabled controls show not-allowed.
- The change is consistent with `DESIGN.md` header icon patterns and spec 001 profile icon button conventions.
- No functional regressions on notification read/dismiss flows or tab navigation.

---

## Dependencies
- Notifications page (`/notifications`) and `useNotifications` hook (`markAllAsRead`, `unreadCount`)
- Existing profile header icon button pattern (`ProfileMeHeader`)
- App shell: `Layout`, `BottomTabBar`, shared back-header and sheet close buttons
- `DESIGN.md` §4 touch targets and header icon guidance

## Assumptions
- User wording "Read all Notifications" refers to the existing mark-all-as-read action on `/notifications` (current copy: "Mark all as read").
- Scope is UI affordance only — no changes to notification data model, realtime, or API.
- Icon selection stays within the project's Lucide icon set.
- Cursor polish targets pointer hover during desktop/mobile-emulation testing; native mobile touch behavior is unchanged.
- A base-layer or shared utility approach is preferred over editing every component individually unless an exception is documented.

---

## Completion Signal

### Implementation Checklist
- [x] Replace "Mark all as read" text button on `Notifications` with an icon button using the shared header icon button style
- [x] Add `aria-label` and 44×44px touch target to the mark-all icon button
- [x] Introduce app-wide pointer cursor rules for interactive elements under fine-pointer hover media query
- [x] Verify disabled states and text inputs are excluded from pointer cursor
- [x] Spot-check primary journeys: notifications, profile header icons, tab bar, back headers, feed/notification list rows, sheets/modals
- [x] Add or update tests for notifications header (icon present when unread, absent when read, accessible name)

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New tests added for new functionality
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Edge cases handled (zero unread, loading state, error retry button)
- [x] Error handling in place

#### Visual Verification (if UI)
- [x] Desktop view looks correct
- [x] Mobile view looks correct (375×667 and 390×844)
- [x] Design matches style guide and profile icon button pattern
- [x] Pointer cursor visible on hover for buttons/links in responsive mode on desktop
- [x] Disabled controls show not-allowed cursor where applicable

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

<!-- NR_OF_TRIES: 1 -->
