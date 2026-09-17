# Specification: Plan Expiry Fix

## Status: COMPLETE

## Feature: Plans expire on schedule and cards never show a past date as time left

### Overview
Prod report 2026-09-17: plans with a planned date never expired and displayed "3 months left". Three defects surfaced:

| # | Defect | Where |
|---|--------|-------|
| 1 | `nightly-expiry` pg_cron job sent a stale bearer; `run-expiry` returned 401 every night. Cron log said "succeeded" (HTTP call worked). | `cron.job`, `supabase/functions/run-expiry/index.ts` |
| 2 | `formatDistanceToNow(expires_at)` is unsigned → past dates render "N months left". Progress bar measured from `created_at` not `accepted_at`. Planned dates parsed as UTC midnight → off by one west of UTC. | `GumPieceCard.tsx`, `PieceDetail.tsx` |
| 3 | `notifications_type_check` allowed 9 of the 15 types the code emits; 6 silently dropped. Discovered when the first successful `run-expiry` 500'd on `plan_expired`. | `public.notifications` |

**In scope:** dedicated cron secret; `describeExpiry` helper + wiring; constraint migration; one-off backfill of the 4 late `plan_expired` notifications.
**Out of scope:** re-sending expiry emails for the 4 late pieces; cron failure alerting (BACKLOG follow-up); soft-closing confirmation sessions.

---

## Functional Requirements

### FR-1: Cron auth decoupled from service-role key
- `run-expiry` accepts `Bearer <SUPABASE_SERVICE_ROLE_KEY>` **or** `Bearer <RUN_EXPIRY_SECRET>` (when the env var is set).
- `supabase/scripts/schedule-run-expiry.sql` stores the secret in Vault (`run_expiry_secret`) and reschedules `nightly-expiry` to read it at run time. `cron.job.command` carries no plaintext token.

### FR-2: `describeExpiry(piece, now)` in `src/lib/expiry.ts`
- `expires_at <= now` or `status = 'expired'` → `Expired` (`Invite expired` for placeholders), state `expired`, progress 0.
- placeholder → `<distance> to accept`.
- active + `planned_date` → `by MMM d`, with ` · today` / ` · tomorrow` / ` · N days left` inside 7 days.
- active without `planned_date` → `<distance> left`.
- progress from `accepted_at ?? created_at` → `expires_at`, clamped 0–100.
- `planned_date` parsed with `parseISO` (local). Same change applied to the three existing `format(...)` calls in `PieceDetail`.

### FR-3: Card and detail use the helper
- `GumPieceCard`: label from helper; warning colour when state ≠ `later`; expired dimmed.
- `PieceDetail`: `Active · <label>`; `Expired · clearing soon` when state is `expired`; bar uses helper progress.

### FR-4: Notification types
- Migration `20260917300000_notifications_type_check_all_types.sql` lists all 15 types.
- `supabase/scripts/backfill-plan-expired-2026-09-17.sql` inserts the missed `plan_expired` rows (idempotent).

---

## Success Criteria (verified in prod 2026-09-17)
- `run-expiry` manual invoke → 200 `{"expired_active":4,...}` then `{"cleaned_sessions":3}` on re-run.
- `gum_pieces`: 4 `expired`; `graveyard`: 4; `notifications` `plan_expired`: 8 rows / 4 pieces; `confirmation_sessions`: 0.
- `cron.job`: `uses_vault = true`, `plaintext_token = false`.
- `npm run quality` green: 160 unit tests (`expiry.test.ts` 9/9).
- Pending: `net._http_response` shows 200 at next 02:00 UTC run.

## Completion Signal
- [x] FR-1–FR-4 shipped
- [x] `DEVDOC.md` §4, §16, matrix item 8; `docs/regression-matrix.md` rows; `PRD.md` scheduled jobs; `BACKLOG.md` incident note; `history.md`; `completion_log/`
