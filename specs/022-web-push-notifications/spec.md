# Specification: Web Push Notifications

## Status: COMPLETE (code) — ops steps pending owner

## Feature: Free OS-level push for every in-app notification

### Overview
In-app notifications (bell, `/notifications`, realtime) already exist. Users get nothing when Clingy is closed. This spec adds **Web Push via VAPID** at **$0**: the browser push services (Google, Apple, Mozilla) are free, sending runs in a Supabase Edge Function, no FCM/Firebase/OneSignal.

Every `notifications` INSERT (except `post_reaction`, which the in-app list hides) fans out to the recipient's subscribed devices. Users opt in from **Settings → Notifications → Push notifications**; there is no unsolicited prompt.

**In scope:** `push_subscriptions` table + RLS; INSERT trigger → `send-push` edge function; custom service worker (`injectManifest`) with `push` / `notificationclick`; Settings toggle with iOS install hint; shared notification copy; dropping the dead permissive `notifications` INSERT policy.
**Out of scope:** per-type push preferences (needs a prefs table), deep links per type (tap opens `/notifications`, which already routes).

### User Stories
- As a user, I want my phone to buzz when someone invites me or a plan needs me, so I don't miss it while Clingy is closed.
- As a user, I want to turn push on/off in Settings without being nagged by a browser prompt.
- As an iPhone user, I want to be told I must add Clingy to my Home Screen before push can work.

---

## Functional Requirements

### FR-1: `push_subscriptions` table
- `supabase/migrations/20260918000000_push_subscriptions.sql`: `id, user_id → users, endpoint UNIQUE, p256dh, auth, user_agent, created_at`; RLS own-rows select/insert/update/delete (UPDATE needed for `upsert onConflict: 'endpoint'`).
- Client `Database` types updated in `src/lib/supabase.ts`.

### FR-2: Fan-out trigger
- `supabase/migrations/20260918000001_notifications_push_trigger.sql`: `AFTER INSERT ON notifications` → `net.http_post` to `send-push`, bearer read from Vault `send_push_secret`, `SECURITY DEFINER`, `set search_path = ''`. Skips `post_reaction`. Skips silently when the Vault secret is absent. Wrapped in `exception when others` so a pg_net error never blocks the insert.
- Same migration drops `notifications_insert_own_or_related` (`WITH CHECK (true)` for `authenticated`): client never inserts (`grep "from('notifications')" src` → only select/update/delete); all inserts come from edge functions with the service role. Leaving it would let any signed-in user spam push to anyone.
- `supabase/scripts/setup-send-push.sql` stores the Vault secret (mirrors `schedule-run-expiry.sql`).

### FR-3: `send-push` edge function
- Auth: `Bearer <SUPABASE_SERVICE_ROLE_KEY>` or `Bearer <SEND_PUSH_SECRET>` (same shape as `run-expiry`).
- Body `{ notification: <row> }` → load recipient's subscriptions → `jsr:@negrel/webpush@0.5.0` (WebCrypto-native, `deno check` clean) → `pushTextMessage(JSON payload, { ttl: 86400, urgency: high, topic: tag })`.
- Responds `202 { queued }` immediately; delivery finishes in `EdgeRuntime.waitUntil`. `200 { sent: 0 }` when no subscriptions.
- 404/410 from the push service → delete that `push_subscriptions` row.
- VAPID key pair cached at module scope.

### FR-4: Service worker
- `vite.config.ts` → `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`.
- `src/sw.ts`: `precacheAndRoute` + `NavigationRoute('/')` (same behaviour as the old generateSW build), `SKIP_WAITING` message (keeps `registerType: 'prompt'` banner working), `push` → always `showNotification` (iOS revokes on silent pushes), `notificationclick` → focus existing window and navigate, else `openWindow('/notifications')`.
- `PWA_DISABLE=true` still emits no SW (Playwright unchanged).

### FR-5: Client + Settings
- `src/lib/pushSupport.ts` (pure): `getPushSupport(env) → 'supported' | 'needs-install' | 'unsupported'`, `urlBase64ToUint8Array`.
- `src/lib/push.ts`: `detectPushSupport`, `getPushStatus` (truth = SW subscription, never localStorage), `subscribeToPush(userId)` (permission → subscribe with `VITE_VAPID_PUBLIC_KEY` → upsert), `unsubscribeFromPush`.
- `src/pages/Settings.tsx`: "Push notifications" `NotificationToggleRow` (hidden when unsupported; disabled while busy / `needs-install` / permission denied); hint copy per state; error line on failure. Toggle runs the permission request inside the click handler (iOS gesture rule).

### FR-6: Shared copy
- `getNotificationCopy` moved from `NotificationItem.tsx` to `supabase/functions/_shared/notificationCopy.ts`; both the list and `_shared/pushPayload.ts` import it. Same precedent as `expiringSoon.ts`.
- `buildPushPayload(row) → { title: 'Clingy', body, url: '/notifications', tag }`; `tag` = `[A-Za-z0-9_-]`, ≤ 32 chars (Web Push `Topic` limit), reused as the browser notification `tag` so repeats for the same piece replace rather than stack.

---

## Success Criteria
- `npm run quality` green: 206 unit tests (`pushSupport.test.ts` 8, `pushPayload.test.ts` 21, `notificationCopy.test.ts` 17).
- `dist/sw.js` contains `push` + `notificationclick` handlers; `PWA_DISABLE=true` build emits none.
- `deno check supabase/functions/send-push/index.ts` passes.
- Live (after ops): any notification insert → `net._http_response` 202; subscribed Android/iOS-installed device shows the notification with the app closed; tap opens `/notifications`.

## Dependencies
- Owner ops (one-time, see `DEVDOC.md` §4 and `supabase/scripts/setup-send-push.sql`):
  1. `npx -y deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts > vapid.json` (stdout = JWK pair; stderr prints the application server key).
  2. `npx supabase secrets set VAPID_KEYS_JSON="$(python3 -c 'import json;print(json.dumps(json.load(open("vapid.json")),separators=(",",":")))')" VAPID_SUBJECT="mailto:<owner>" SEND_PUSH_SECRET="$(openssl rand -hex 32)"` — then confirm `npx supabase secrets list` shows `VAPID_KEYS_JSON` with a digest **other than** `e3b0c442…` (that is the SHA-256 of an empty string; happened once when `jq` wasn't installed and `$(jq …)` expanded to nothing).
  3. `npx supabase functions deploy send-push`
  4. `npx supabase db push`
  5. Run `supabase/scripts/setup-send-push.sql` with the same `SEND_PUSH_SECRET`.
  6. Vercel env `VITE_VAPID_PUBLIC_KEY` = stderr value from step 1 (Production + Preview); redeploy.
  7. `rm vapid.json` (keep in a password manager).
- devDeps: `workbox-precaching`, `workbox-routing`, `workbox-core`.

## Assumptions
- iOS 16.4+ and the PWA installed to the Home Screen; not available for iOS users in the EU (17.4+).
- `@negrel/webpush` crypto is not externally audited — acceptable for this app.
- Until the Vault secret exists the trigger is a no-op; nothing breaks in an unconfigured environment.

---

## Completion Signal
- [x] FR-1–FR-6 shipped; `npm run quality` green
- [x] `DEVDOC.md` (Notifications flow, §4 auth, manual test 15), `docs/regression-matrix.md`, `history.md`, `completion_log/`
- [x] Ops steps 1–7 run by owner 2026-09-17; live: `202 {"queued":1}`, notification delivered to Android shade
- [x] Follow-up: app icon badge via Badging API (`src/lib/appBadge.ts`, SW `setAppBadge(unread)`, `send-push` includes unread count)

<!-- NR_OF_TRIES: 1 -->
