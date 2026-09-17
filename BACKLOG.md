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

Functionally no gap. But ~40 prod policies exist **nowhere in the repo** (`*_own`, `*_participant`, `qr_*`, `blocked_users`, `categories`, `confirmation_sessions`, `graveyard`…). Repo is not source of truth for RLS. → **Action:** `npx supabase db pull` (or `db dump --schema public` policies only) into a baseline migration, then delete `week*.sql`. Tracked as spec candidate *019-rls-baseline-migration*.

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
