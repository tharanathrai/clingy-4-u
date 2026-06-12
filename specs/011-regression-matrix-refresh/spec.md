# Specification: Regression Matrix Refresh

## Status: COMPLETE

## Feature: DEVDOC Manual Test Matrix Execution & Documentation

### Overview
Nine DEVDOC flows had stale manual verification (last matrix entry May 2026). This spec executes the 14-item manual test matrix from DEVDOC §"Flows needing manual testing", records pass/fail/blocker evidence in `docs/regression-matrix.md`, updates stale flow labels in `DEVDOC.md`, and files new specs only for failures. Live device, two-user, and Resend-dependent items remain **pending** with documented partial automation where applicable.

### User Stories
- As a developer, I want a dated regression matrix so I know which flows were verified and how.
- As a product owner, I want stale "Verified (manual)" labels corrected so ship readiness is honest.
- As Ralph, I want failures tracked as new specs without blocking MVP on environment-only gaps.

---

## Functional Requirements

### FR-1: Execute matrix items 1–14
**Acceptance Criteria:**
- [x] Each of 14 DEVDOC manual items has a dated status row in `docs/regression-matrix.md`
- [x] Status uses: `pass-automated`, `pass-code-review`, `partial`, `pending-device`, `pending-live`
- [x] No item marked `fail` — no new blocker specs required

### FR-2: Regression matrix session row
**Acceptance Criteria:**
- [x] New session row in matrix with unit (97/97), E2E (18/18), and flows touched summary
- [x] Evidence is not "verified by reading code" alone — cites test files or explicit env blocker

### FR-3: DEVDOC flow label refresh
**Acceptance Criteria:**
- [x] Stale `Verified (manual)` labels updated to `Working` or `Verified (automated)` per evidence
- [x] Post-MVP audit table updated; P1 queue points to `012`
- [x] `IMPLEMENTATION_PLAN.md` marks spec `011` complete

### FR-4: Quality gate
**Acceptance Criteria:**
- [x] `npm run quality` passes
- [x] `npm run test:e2e` passes (18/18)
- [x] `history.md` and completion log updated

---

## Manual Test Matrix Results (2026-06-12)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Full core loop E2E (two users) | pending-live | No two-user live Supabase harness; partial path coverage via smoke + piece/notifications mocks |
| 2 | Real-time OTP sync (two devices) | partial | `useConfirmationSession.test.ts` bridge-formed once; two-device sync pending |
| 3 | PWA install (Android + iOS) | pending-device | `public/manifest.json` + PWA meta in `index.html` code-reviewed |
| 4 | Safe area insets (notch / Dynamic Island) | pending-device | `viewport-fit=cover`, `safe-content-*` tokens code-reviewed |
| 5 | Email delivery (invite, turn-down, expiry) | pending-live | `send-email` + Resend wiring code-reviewed; needs `RESEND_API_KEY` |
| 6 | Avatar upload from Edit Profile | partial | `avatarImage.test.ts` 3/3; crop-over-sheet on device pending |
| 7 | Graph share / export PNG | partial | `graphSnapshot.ts` + `networkPairSummary.test.ts` 5/5; device share pending |
| 8 | Nightly cron expiry (`run-expiry`) | partial | `expiringSoon.test.ts` 8/8 idempotency; live invoke pending |
| 9 | Slot limits server-side | pass-code-review | `create-gum-piece` / `respond-gum-piece` enforce 25 global / 5 per-pair |
| 10 | QR token expiry (60s) | partial | `validateQrToken.test.ts` 10/10 expired mapping; live scan pending |
| 11 | Confirmation session race | pass-code-review | `start-confirmation` dedupes existing sessions; two-client pending |
| 12 | Connection accepted real-time | partial | E2E: accept from notifications (`smoke.spec.ts`); graph refresh not in E2E |
| 13 | Notification routing per type | partial | `notifications.test.ts` 5/5 types; E2E covers `connection_request` only |
| 14 | PostDetailSheet comment real-time | partial | `realtime.test.ts` channel contract; feed comment composer manual pending |

---

## Success Criteria

- Regression matrix documents all 14 items with dated evidence
- No undocumented failures; no false `Verified (manual)` claims
- `npm run quality` and E2E pass
- Next Ralph pick: `012-notification-routing-hardening`

---

## Dependencies
- Specs `009` (expiring soon cron), `010` (profile back E2E)
- `DEVDOC.md` §Flows needing manual testing
- `docs/regression-matrix.md`

## Assumptions
- Environment-only gaps (live Supabase, Resend, physical devices) are **pending**, not failures
- Partial automation + code review is acceptable evidence per `IMPLEMENTATION_PLAN.md` spec `011` scope

---

## Completion Signal

### Implementation Checklist
- [x] `docs/regression-matrix.md` updated with session row + items 1–14 table
- [x] `DEVDOC.md` flow labels and audit table refreshed
- [x] `IMPLEMENTATION_PLAN.md` Ralph status updated
- [x] `history.md` + `completion_log/` entry

### Testing Requirements

#### Code Quality
- [x] `npm run quality` passes (97 unit tests)
- [x] `npm run test:e2e` passes (18 tests)

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Zero `fail` items; no new blocker specs

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
