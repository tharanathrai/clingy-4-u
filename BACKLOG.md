# UX Follow-Ups (from live testing)

> Product truth lives in `PRD.md`, `DESIGN.md`, and `DEVDOC.md` (last synced 2026-06-11).

## Network Graph Viewport + Export

1. Share image quality is poor for social posting. ✅ Addressed (spec `016-social-share-export`)
   - Bridge Constellation Card: 4:5 (1080×1350), stats footer, category glow, grain, export-only zoom/label boost.
   - Stretch deferred: square/stories presets, spotlight card when a node is selected.

2. Desktop graph framing can start far from the visible viewport. ✅ Addressed
   - Implemented container-based canvas sizing (instead of viewport-only sizing).
   - Added deterministic camera recenter + zoom-to-fit on graph load.
   - Added zoom limits to avoid extreme initial framing.

3. Mobile graph framing feels over-zoomed/cropped. ✅ Addressed
   - Implemented mobile-aware zoom-to-fit padding on initial graph framing.
   - Added orientation/resize camera sizing updates for mobile viewport changes.

## App Lifecycle / Refresh UX

4. App appears to refresh/reload when switching tabs/windows or navigating between pages. ✅ Addressed
   - Reworked auth state handling into a shared store in `useAuth` so pages/hooks do not repeatedly re-enter loading on remount.
   - Added stale-while-revalidate caches in `useNotifications`, `useGumPieces`, `useNetworkGraph`, and home connection count fetch to avoid loading flashes on tab/page switches.
   - Goal is preserved route/UI state without disruptive "session checking" flashes when switching tabs/windows.

## Mobile / Install

5. PWA install shipped (service worker via `vite-plugin-pwa`, installable on Android + iOS, offline shell, reload prompt). Deferred follow-ups:
   - Push notifications + icon badges layer onto the same SW (VAPID + Supabase Edge Function sender; iOS push needs installed PWA on 16.4+). Seam documented in `src/lib/registerPwa.ts`.
   - Native Capacitor wrappers (`android/`, `ios/`) are **stale/unshippable**: `@capacitor/cli ^7.6.5` mismatches `@capacitor/core|android|ios ^8.3.4`, no native plugins used, nothing published to stores. Align versions before any native store path.

## Health check — 2026-09-17

First session after ~3 months idle (last commit 2026-06-20). Audit only — no code changes.

### Local gate
- `npm install`: no lockfile changes. `npm run quality` **green**: typecheck ✓, lint ✓ (0 warnings), vitest 30 files / **151 tests** ✓, build ✓ (main chunk 204.61 kB / 65.35 kB gzip).
- `npm audit --omit=dev`: 10 vulns (1 critical `tar` via `supabase` CLI dep, 8 high incl. `vite` 8.0.3, `react-router-dom`, `ws`, 1 moderate). All have `fixAvailable`. → **Action:** `npm audit fix` in its own commit, then re-run `npm run quality`. `vite`/`ws` are dev-server only; `react-router-dom` is the one shipped to users.
- Supabase CLI v2.84.6 (devDep, via `npx`); v2.117.0 available.

### Prod Supabase (`hceigqxjpqwrmnajfoii`, linked + logged in)
| Check | Result |
|---|---|
| Migrations | **13/13 applied** — local and remote lists match through `20260619110000_analytics_events` |
| Edge functions | **15/15 ACTIVE**, all last deployed 2026-06-20 05:22 UTC (incl. `track-events` v4) |
| Secrets | `ANALYTICS_SALT` ✓, `RESEND_API_KEY` ✓, `RESEND_FROM_EMAIL` ✓. Stale: `SENDGRID_API_KEY` (no code references Sendgrid) → remove |
| RLS enabled | all 15 public tables `RLS on` |

Analytics pipeline is therefore **live** (memory note claiming "needs ANALYTICS_SALT + deploy" was stale). Next step is the insight loop: `docs/ANALYTICS_LOOP.md`.

### RLS: repo `week*.sql` vs prod `pg_policies`
Prod has **57 policies**; repo week-files define 16. Diff:

| Week-file policy | Prod |
|---|---|
| week2 `Users can view their own gum pieces` | absent — **intentionally** superseded by `gum_pieces_select_for_members` (migration `20260617400000` drops all gum_pieces SELECT policies) |
| week2 `Users can view their own notifications` | absent by name; equivalent `Users can see their own notifications` + `notifications_select_own` present |
| week5 `Profiles are publicly viewable` | absent by name; equivalent `Users can read any profile` present |
| week5 `Users can update their own profile` | absent by name; equivalent `Users can update own profile` + `users_update_own` present |
| week5 `Users can view their own connections` | absent by name; equivalent `Users can see their own connections` + `connections_select_participant` present |
| other 11 (week2 ×2, week4 ×1, week6 ×8) | present ✓ |

Functionally no gap. But ~40 prod policies exist **nowhere in the repo** (`*_own`, `*_participant`, `qr_*`, `blocked_users`, `categories`, `confirmation_sessions`, `graveyard`…). Repo was not source of truth for RLS. ✅ **Fixed 2026-09-17:** `supabase/migrations/20260917100000_rls_baseline.sql` mirrors all 52 prod policies (generated from `pg_policies`, idempotent DROP+CREATE); `week*.sql` files deleted. Remaining gap: base table DDL (users, gum_pieces, bridges, …) predates the first migration and is still unversioned — `supabase db dump` needs Docker or `pg_dump`, neither on this machine. → **Action:** install `postgresql-client`, run `npx supabase db dump --linked -f supabase/schema_baseline.sql`, commit as reference (not a migration).

### ⚠️ Security finding — `rotating_qr_tokens` over-permissive policies ✅ Fixed 2026-09-17
Migration `20260917000000_drop_permissive_qr_token_policies.sql` pushed; prod verified — only `user_id = auth.uid()` policies remain.

Prod had these policies on `public.rotating_qr_tokens` for role `authenticated`:
- `qr_select_any_auth` — `SELECT USING (true)`
- `qr_delete_any_auth` — `DELETE USING (true)`
- `qr_tokens_delete_any_authenticated` — `DELETE USING (true)`

Any signed-in user can read every user's live QR token via the anon key and PostgREST, then call `validate-qr-token` to create a connection without ever scanning. They can also delete anyone's tokens. This defeats PRD §19 "connections via QR only / rotating single-use tokens". The client never queries this table directly (`src/lib/supabase.ts` has only the type; `generate-qr-token` and `validate-qr-token` use the service-role client, which bypasses RLS), so these policies serve no product purpose.

**Fix (applied):**
```sql
drop policy if exists "qr_select_any_auth" on public.rotating_qr_tokens;
drop policy if exists "qr_delete_any_auth" on public.rotating_qr_tokens;
drop policy if exists "qr_tokens_delete_any_authenticated" on public.rotating_qr_tokens;
```
Remaining `qr_tokens_*_own` / `Users can manage their own QR tokens` policies are scoped to `user_id = auth.uid()` and can stay. Live QR scan on device still pending (regression matrix item 10).

### Drift from docs
- `blocked_users` table exists in prod with RLS + policy `Users can manage their own blocks`; PRD §18 says the table is "not yet created". Update PRD or confirm table is unused.
- Duplicate legacy/new policy pairs on `users`, `connections`, `notifications`, `posts`, `reactions`, `comments`, `bridges`, `graveyard`, `confirmation_sessions` (e.g. `Posts visible to network` + `Network members can see posts`). Harmless (permissive OR) but should collapse during the RLS baseline work.

### Still pending from before (unchanged)
- Regression matrix items 1–14: 12 never verified live/on-device (`docs/regression-matrix.md`).
- `016-capacitor-version-align` (`@capacitor/cli` ^7.6.5 vs core ^8.3.4), `017-avatar-storage-cleanup`, `018-graph-export-social-preset`.
- Design v2: bridge formation animation, my-bridges share card; Claude Design project rename.

## Analytics insights — 2026-09-17

First run of the insight loop (`specs/analytics-insight-loop.md`). The pack's 7–14-day windows are empty because the app has been idle since 2026-06-22 (last piece created 2026-06-21; only 2 `/` screen views since, last 2026-09-13). Numbers below are **all-time** re-runs of the same views. Population is one friends-and-family cohort (11 users, week of 2026-06-15), so treat every ratio as directional, not statistical.

**Funnel (all-time):** 11 signed up → 9 connected (82%) → 4 created a piece (36%) → 2 reached a confirmed piece (18%). Domain totals: 8 active connections, 13 pieces (6 active, 4 confirmed, 2 turned down, 1 placeholder), 4 bridges, 8 posts / 10 reactions / 7 comments, graveyard 0.

**Behavior events:** 618 events from 20 pseudonyms (users × install ids). Screen views: `/home` 142, `/network` 67, `/notifications` 59, `/piece/:id` 52, `/feed` 48, `/profile/me` 39, `/add` 23, `/piece/:id/confirm` 13, `/add/scan` 7, `/settings` 5, `/profile/:username` 4, `/home/graveyard` 2. Confirm ceremony: 13 `confirm_enter` → 8 `confirm_success`, 4 `confirm_abandon` (31% abandon). QR: 6 attempts, 5 success, 1 failure. Median time-to-confirm for confirmed pieces: 54 s. `rage_tap`: 0. `feed_dwell`: 38 events (median unavailable — see item 4).

### Items

1. **[impact: high] Connected-but-never-created is the biggest drop.** 9 users connected, only 4 ever created a piece (−56%), and `/add` (23 views) got 3× the traffic of `/add/scan` (7). People finish the QR handshake and then don't know what to do next. Candidate spec: post-connection nudge — after `connection_accepted`, land on `/piece/new` pre-filled with the new friend, or a "make your first plan with {name}" card on `/home`.

2. **[impact: high] Confirm ceremony abandonment 31% (4/13).** 3 `confirmation_sessions` expired with ≤1 confirmer; abandons cluster 2026-06-21/22, right after the hold-to-confirm v2 shipped (2026-06-18). Two-device sync is still unverified (regression matrix #2). Candidate spec: instrument `confirm_abandon` with a reason enum (`timeout`, `navigated_away`, `partner_never_joined`) and verify the ceremony on two physical devices before drawing conclusions.

3. ✅ **[impact: high] Instrumentation bug — `analytics.confirmation_funnel.sessions_completed` is always 0.** Fixed in spec `020` (migration `20260917200000`). `submit-confirmation/index.ts:275` deletes the session row on success, so the view only ever sees failures (3 started / 0 completed / 3 expired while 4 pieces are confirmed). Fixed by deriving completions from `gum_pieces.confirmed_at`. Corrected all-time: 7 started / 4 completed / 3 expired (43% abandon — worse than the 31% the client events showed).

4. ✅ **[impact: med] Instrumentation bug — `analytics.engagement_summary.posts_total` is inflated 2.5×.** Fixed in spec `020`. `count(*)` over `posts LEFT JOIN reactions LEFT JOIN comments` multiplies rows (reports 20, table has 8). Now `count(DISTINCT po.id)`. (`feed_dwell` median null was a false alarm — props do carry `dwell_ms`; the 14-day window was simply empty.)

5. **[impact: med] Zero week-1+ retention.** `retention_cohorts` shows only `week_offset 0` (4 active). Definition is "created a piece in week N", and nobody created one after 2026-06-21 — even though screen views continued into July. Users came back to look, not to act. Ties to item 1; also suggests `/home` needs a reason to return when the pocket is quiet (expiring-soon nudges are built — `run-expiry` cron live invoke still unverified, matrix #8).

6. **[impact: low] Dead surfaces:** `/settings` 5 views, `/profile/:username` 4, `/home/graveyard` 2 (graveyard is empty, expected). `/profile/:username` being this low with 8 active connections means people rarely look at each other's profiles — the shared-bridges section there (spec 013) is barely seen. Defer; revisit with more users.

**Disposition:** items 3 + 4 shipped as spec `020-analytics-view-fixes`. Items 1, 2, 5 deferred until there is a second cohort — the current data cannot separate product friction from "friends tried it once". Item 6 deferred.
