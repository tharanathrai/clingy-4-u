# Completion: 021-plan-expiry-fix

**Date:** 2026-09-17  
**Spec:** `specs/021-plan-expiry-fix/spec.md`

## Shipped

- FR-1: `run-expiry` accepts `RUN_EXPIRY_SECRET`; `schedule-run-expiry.sql` reschedules `nightly-expiry` with a Vault-read bearer
- FR-2: `src/lib/expiry.ts` `describeExpiry` — past-date guard, `by MMM d` for planned pieces, progress from `accepted_at`, `parseISO`
- FR-3: `GumPieceCard`, `PieceDetail` wired
- FR-4: `notifications_type_check` widened to 15 types; 8 missed `plan_expired` rows backfilled

## Tests

- `expiry.test.ts` 9/9
- Live: `run-expiry` 200, 4 expired / 4 graveyard / 8 notifications / 3 sessions cleaned

## Quality

- `npm run quality` pass (160 unit tests)
