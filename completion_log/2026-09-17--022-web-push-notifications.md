# Completion: 022-web-push-notifications

**Date:** 2026-09-17  
**Spec:** `specs/022-web-push-notifications/spec.md`

## Shipped

- FR-1: `push_subscriptions` table + RLS (`20260918000000`)
- FR-2: `notifications_push_after_insert` trigger → pg_net → `send-push`, Vault-backed bearer; skips `post_reaction`; drops the `WITH CHECK (true)` notifications INSERT policy (`20260918000001`); `scripts/setup-send-push.sql`
- FR-3: `send-push` edge function on `jsr:@negrel/webpush` — 202 + `EdgeRuntime.waitUntil` fan-out, stale-endpoint cleanup on 404/410
- FR-4: `injectManifest` + `src/sw.ts` (`push`, `notificationclick`, `SKIP_WAITING`)
- FR-5: `src/lib/push.ts`, `src/lib/pushSupport.ts`, Settings "Push notifications" toggle with iOS install hint
- FR-6: `getNotificationCopy` → `_shared/notificationCopy.ts`; `_shared/pushPayload.ts`

## Tests

- `pushSupport.test.ts` 8/8, `pushPayload.test.ts` 21/21, `notificationCopy.test.ts` 17/17
- `deno check` on `send-push` clean; `dist/sw.js` built with push handlers; `PWA_DISABLE=true` emits no SW

## Quality

- `npm run quality` pass (206 unit tests)

## Follow-up fix (same day)

- Prod SW failed evaluation: `createHandlerBoundToURL('/')` throws `non-precached-url` (precache key is `/index.html`). Symptom: Settings toggle → "Service worker is not registered"; also no offline shell / update banner. Fixed; `scripts/verify-sw.mjs` now runs after `vite build` and fails the build if `dist/sw.js` throws or lacks `push`/`notificationclick`/`message` listeners. Verified with headless Chromium: registration active, offline deep link served.

## Pending (owner)

- VAPID keys + 3 edge secrets, `functions deploy send-push`, `db push`, `setup-send-push.sql`, Vercel `VITE_VAPID_PUBLIC_KEY` — see spec Dependencies
