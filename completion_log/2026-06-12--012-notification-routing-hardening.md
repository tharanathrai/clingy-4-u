# Completion: 012-notification-routing-hardening

**Date:** 2026-06-12

## What was built

- `specs/012-notification-routing-hardening/spec.md` — P1 stale expiry tap spec (COMPLETE)
- `src/lib/notificationRouting.ts` — shared stale gum-piece tap resolver
- `src/pages/Notifications.tsx` — uses helper for `invite_received` + `plan_expiring_soon`
- `src/tests/notificationRouting.test.ts` — 6 unit tests
- `DEVDOC.md` — v0.10; known issue #1 (stale expiry tap) resolved; P1 queue complete
- `IMPLEMENTATION_PLAN.md` — spec `012` marked complete

## Verified

- `npm run quality` — 103/103 unit tests, build pass
- Stale `plan_expiring_soon` on expired piece → dismiss + "This plan has already expired." toast
- Active piece routing unchanged

## Next Ralph pick

P2 specs `013`+ when promoted by product owner
