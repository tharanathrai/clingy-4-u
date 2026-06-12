# Specification: Notification Routing Hardening

## Status: COMPLETE

## Feature: Stale `plan_expiring_soon` Tap Handling

### Overview
When a user taps a `plan_expiring_soon` notification after the gum piece has already expired, they are routed to piece detail (correct UX) but the notification stays in the list as read. This spec auto-dismisses stale expiry warnings and shows inline feedback, matching the existing `invite_received` expired-invite pattern.

### User Stories
- As a user tapping an old expiry warning, I want the notification cleared so my list stays accurate.
- As a user with a still-active plan, I want tapping `plan_expiring_soon` to open piece detail as today.
- As a developer, I want unit tests on the tap branch so routing cannot regress silently.

---

## Functional Requirements

### FR-1: Dismiss stale `plan_expiring_soon`
When the referenced gum piece `status` is `expired`, tapping `plan_expiring_soon` dismisses the notification instead of leaving a stale row.

**Acceptance Criteria:**
- [x] Tap on stale `plan_expiring_soon` calls `dismissNotification` after `markAsRead`
- [x] Inline toast explains the plan already expired (no navigation)
- [x] Piece detail UX for direct `/piece/:id` visits remains unchanged

### FR-2: Valid routing preserved
Active or non-expired pieces still route to `/piece/:referenceId`.

**Acceptance Criteria:**
- [x] `plan_expiring_soon` on `active` piece navigates to piece detail
- [x] Other notification types unchanged (`invite_received` stale handling preserved)

### FR-3: Test coverage
**Acceptance Criteria:**
- [x] Unit tests cover stale vs valid `plan_expiring_soon` branches
- [x] `npm run quality` passes

---

## Success Criteria

- No stale unread/read rows after tapping expired-piece expiry warnings
- No console errors; existing notification routing intact
- `DEVDOC.md` known issue #2 resolved

---

## Dependencies
- `src/pages/Notifications.tsx`
- `src/hooks/useNotifications.ts`
- Spec `009` (`plan_expiring_soon` cron)

## Assumptions
- Dismiss = delete row (existing `dismissNotification` behavior)
- Toast copy aligns with invite-expired pattern

---

## Completion Signal

### Implementation Checklist
- [x] `notificationRouting` helper + tests
- [x] `Notifications.tsx` uses helper for `plan_expiring_soon` (+ refactored `invite_received`)
- [x] `DEVDOC.md`, `IMPLEMENTATION_PLAN.md`, `history.md` updated
- [x] `completion_log/` entry

### Testing Requirements

#### Code Quality
- [x] `npm run quality` passes (103 unit tests)
- [x] New unit tests for tap handler branch

#### Functional Verification
- [x] All acceptance criteria verified

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
