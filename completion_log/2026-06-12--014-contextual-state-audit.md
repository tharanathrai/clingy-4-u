# Completion: spec 014 — contextual-state-audit

**Date:** 2026-06-12

## Shipped

- `src/lib/navigationContext.ts` — shared `AppLocationState` helpers
- C-01: `BridgeDetailSheet` network **View profile** passes `returnTo` + `selectUserId`
- C-02: `SharedBridgesSection` **New gum** passes profile `returnTo`
- C-03: Extended `notificationRouting.ts` for terminal piece statuses on all gum-piece route types
- C-04: `PostDetailSheet` profile taps pass `returnTo: '/feed'` (stretch `restorePostId` deferred)
- `DEVDOC.md` §Navigation context with entry-point matrix and P2 dispositions
- `IMPLEMENTATION_PLAN.md` updated with spec 014 completion and C-xx tracker

## Verified

- `npm run quality` pass
- Unit: `navigationContext.test.ts`, `sharedBridgesSection.test.tsx`, extended `notificationRouting.test.ts` + `bridgeDetailSheet.test.tsx`
- E2E: `profile-back.spec.ts` C-02 profile new-gum back
