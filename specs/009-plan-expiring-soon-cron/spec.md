# Specification: Plan Expiring Soon Cron

## Status: COMPLETE

## Feature: 30-Day Plan Expiry Warnings via `run-expiry`

### Overview
The `plan_expiring_soon` notification type exists in schema, UI copy, and routing, but `run-expiry` did not emit warnings. This spec extends the nightly cron edge function to notify both parties when an active gum piece expires within 30 days, with idempotent in-app notifications and optional email via `send-email`.

### User Stories
- As a user with an active plan nearing expiry, I want an in-app notification so I can confirm it before it expires.
- As a user who prefers email, I want a warning email when Resend is configured, matching invite and expiry patterns.
- As an operator running the cron nightly, I want re-runs to skip pieces/users that already received a warning.

---

## Functional Requirements

### FR-1: Detect active pieces in the 30-day window
`run-expiry` must find active gum pieces expiring within 30 days that are not yet past `expires_at`.

**Acceptance Criteria:**
- [x] Query selects `status = active` pieces where `expires_at > now` and `expires_at <= now + 30 days`
- [x] Already-expired and placeholder pieces are excluded
- [x] Pieces more than 30 days from expiry are excluded

### FR-2: Idempotent in-app notifications
Both `creator_id` and `recipient_id` receive at most one `plan_expiring_soon` notification per piece.

**Acceptance Criteria:**
- [x] Both parties get `plan_expiring_soon` rows with `reference_id = piece.id`
- [x] Re-running cron does not duplicate notifications for the same user/piece pair
- [x] Existing `plan_expired` rows do not block new `plan_expiring_soon` rows

### FR-3: Optional email delivery
Email follows the same `send-email` pattern as plan expiry and invites.

**Acceptance Criteria:**
- [x] Email sent only for users who received a new notification row this run
- [x] Subject/body reference the plan title and partner display name
- [x] Missing email addresses are skipped without failing the cron

### FR-4: Documentation sync
Product docs reflect shipped behavior.

**Acceptance Criteria:**
- [x] `DEVDOC.md` known issue #1 resolved
- [x] `PRD.md` §14 removes "Not yet implemented" for `plan_expiring_soon`
- [x] `PRD.md` §17 deferred list no longer lists this cron as v2

---

## Success Criteria

- Nightly `run-expiry` emits `plan_expiring_soon` for eligible active pieces
- Both users notified once per piece; cron re-run is safe
- Response JSON includes `expiring_soon_notified` count
- Unit tests cover window logic and idempotency

---

## Dependencies
- `supabase/functions/run-expiry/index.ts`
- `supabase/functions/send-email/index.ts`
- Existing notifications UI (`NotificationItem`, `Notifications.tsx`, `useNotifications.ts`)

## Assumptions
- Stale `plan_expiring_soon` tap on already-expired pieces remains spec `012`
- 30-day window is inclusive at the upper bound (`expires_at <= now + 30d`)
- Cron auth remains service-role bearer only

---

## Completion Signal

### Implementation Checklist
- [x] Shared `expiringSoon.ts` helpers for window + idempotent row building
- [x] `run-expiry` inserts notifications and sends emails before active expiry pass
- [x] `src/tests/expiringSoon.test.ts` covers window and idempotency
- [x] `DEVDOC.md`, `PRD.md`, `history.md` updated

### Testing Requirements

#### Code Quality
- [x] `npm run quality` passes

#### Functional Verification
- [x] All acceptance criteria verified via unit tests and code review

#### Documentation Verification
- [x] Known issue #1 removed from DEVDOC
- [x] PRD §14/§17 aligned with implementation

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
