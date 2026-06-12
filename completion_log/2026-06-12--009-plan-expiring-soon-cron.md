# Completion: 009-plan-expiring-soon-cron

**Date:** 2026-06-12

## What was built

- `supabase/functions/_shared/expiringSoon.ts` — 30-day window helpers and idempotent notification row builder
- `supabase/functions/run-expiry/index.ts` — emits `plan_expiring_soon` before active expiry pass; optional email per newly notified user
- `src/tests/expiringSoon.test.ts` — window and idempotency unit tests
- `specs/009-plan-expiring-soon-cron/spec.md` — marked COMPLETE

## Verified

- `npm run quality` passes
- Unit tests cover 30-day window boundaries and duplicate suppression
- `DEVDOC.md` known issue #1 removed; `PRD.md` §14/§17 updated

## Next Ralph pick

`specs/010-profile-back-e2e`
