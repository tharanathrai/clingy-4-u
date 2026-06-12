# Regression Matrix

Every agent session that touches application code must add a row here before marking work done.
Blank rows or "verified by reading code" alone are not acceptable evidence.

---

## How to fill this in

| Column | What to write |
|---|---|
| **Session** | Date + short description (e.g. "2026-05-22 React Query migration") |
| **Flows touched** | Which flows from DEVDOC were modified |
| **Shared hooks/libs changed** | Any files in `src/hooks/` or `src/lib/` |
| **Edge functions changed** | Any files under `supabase/functions/` |
| **Unit tests** | Test file + pass/fail summary (e.g. `realtime.test.ts 6/6 ✓`) |
| **E2E smoke** | Playwright result or "pending — no preview URL" |
| **Known regressions** | Any issues found but not fixed in this session |

---

## Matrix

| Session | Flows touched | Shared hooks/libs | Edge fns | Unit tests | E2E smoke | Known regressions |
|---|---|---|---|---|---|---|
| 2026-05-15 React Query migration | All 15 flows | All hooks (useQuery/useMutation), useAuth | None | None (pre-test-suite) | Manual | mid-file import in useBridgesByPair; Realtime channel reuse |
| 2026-05-15 Bug fixes | Auth, Onboarding, Network, Notifications | useBridgesByPair, useNetworkGraph, useNotifications, useGumPieces, useFeed, usePost, useConfirmationSession | None | None | Manual | profileReadyCache onboarding loop |
| 2026-05-22 Production Quality System | All flows (shared lib migration) | src/lib/realtime.ts (new), queryKeys.ts (new), invalidate.ts (new), useProfileReady.ts (new), all 8 realtime hooks migrated | None | `realtime.test.ts` 6/6 ✓, `categorizeTitle.test.ts` 11/11 ✓, `validateQrToken.test.ts` 10/10 ✓, `useProfileReady.test.ts` 5/5 ✓, `notifications.test.ts` 5/5 ✓ | Playwright smoke suite created (CI) | exhaustive-deps warnings on 5 useMemo hooks (non-breaking) |
| 2026-05-26 Edit Profile save state fix | Profile (own), Settings | None | None | `npm run quality` pass | Manual: save → reopen → second save on `/profile/me` and `/settings` | None |
| 2026-05-26 Avatar upload UX | Onboarding, Profile (own), Settings | `constants.ts`, `avatarImage.ts` (new), `useAvatarUpload.ts` (new) | None | `avatarImage.test.ts` 3/3 ✓, `npm run quality` 49/49 ✓ | E2E smoke unchanged (no “Choose File” dependency) | Crop sheet over nested edit sheet needs manual check on device; Storage files not deleted on remove |
| 2026-05-26 Network graph highlight | Network Graph | `networkPairSummary.ts` (new), `graphSnapshot.ts` (new) | None | `networkPairSummary.test.ts` 5/5 ✓, `npm run quality` pass | Manual: chalk spokes, share menu, header menu | Native share requires HTTPS/device; selection physics feel needs device pass |
| 2026-05-26 Network share + docs | Network Graph, Connection requests | `graphSnapshot.ts`, `GraphShareButton.tsx`, `Network.tsx` | None | `npm run quality` pass | Manual: share without selection; export with selection restores | None |
| 2026-06-11 Docs sync with MVP | All flows (documentation only) | None | None | N/A | N/A | None |
| 2026-06-11 Post-MVP audit (spec 008) | All flows (audit only) | None | None | N/A | N/A | Manual items 1–14 pending — see `IMPLEMENTATION_PLAN.md` spec `011` |
| 2026-06-12 Regression matrix refresh (spec 011) | All 15 flows (audit + label refresh) | None | None (read-only review) | 97/97 ✓ (`expiringSoon.test.ts` 8/8, `validateQrToken.test.ts` 10/10, `profile-back` unit 6/6) | Playwright 18/18 ✓ | No failures; 6 items pending-live, 3 pending-device, 5 partial — see table below |
| 2026-06-12 Contextual state audit (spec 014) | Profile, Network, Feed, Notifications | `navigationContext.ts`, `notificationRouting.ts` | None | `navigationContext.test.ts` 4/4, `sharedBridgesSection.test.tsx` 1/1, `notificationRouting.test.ts` 12/12, `bridgeDetailSheet.test.tsx` extended | Playwright 19/19 ✓ (`profile-back` C-02) | C-04 `restorePostId` overlay restore deferred |
| 2026-06-12 Feed profile navigation (spec 015) | Feed, Profile | `Feed.tsx`, `PostDetailSheet.tsx`, `ProfileUser.tsx`, `navigationContext.ts` | None | `feedProfileNavigation.test.tsx` 3/3, `navigationContext.test.ts` extended, `profileUser.test.tsx` +1 | Playwright 20/20 ✓ (post detail restore F-03) | C-04 stretch shipped; own-profile tap gate F-01 |

---

## Manual test matrix (spec 011 — 2026-06-12)

Statuses: **pass-automated** | **pass-code-review** | **partial** | **pending-device** | **pending-live** | **fail**

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Full core loop E2E (two users) | pending-live | No two-user live harness; smoke + mocked paths only |
| 2 | Real-time OTP sync (two devices) | partial | `useConfirmationSession.test.ts`; two-device sync not run |
| 3 | PWA install (Android + iOS) | pending-device | `manifest.json` + `index.html` meta code-reviewed |
| 4 | Safe area insets (notch / Dynamic Island) | pending-device | `viewport-fit=cover`, `safe-content-*` CSS code-reviewed |
| 5 | Email delivery (invite, turn-down, expiry) | pending-live | `send-email` edge fn; needs `RESEND_API_KEY` in Supabase |
| 6 | Avatar upload from Edit Profile | partial | `avatarImage.test.ts` 3/3; crop-over-sheet on device pending |
| 7 | Graph share / export PNG | partial | `graphSnapshot.ts`, `networkPairSummary.test.ts` 5/5; device share pending |
| 8 | Nightly cron expiry (`run-expiry`) | partial | `expiringSoon.test.ts` 8/8 idempotency; live invoke pending |
| 9 | Slot limits server-side | pass-code-review | `create-gum-piece` / `respond-gum-piece` enforce 25 / 5 limits |
| 10 | QR token expiry (60s) | partial | `validateQrToken.test.ts` 10/10; live 60s scan pending |
| 11 | Confirmation session race | pass-code-review | `start-confirmation` dedupes duplicate sessions |
| 12 | Connection accepted real-time | partial | E2E accept from notifications; graph refresh not in E2E |
| 13 | Notification routing per type | partial | `notifications.test.ts` 5/5; E2E `connection_request` only |
| 14 | PostDetailSheet comment real-time | partial | `realtime.test.ts` 6/6; feed comment composer manual pending |

**Session outcome:** 0 fail, 2 pass-code-review, 5 partial, 3 pending-device, 4 pending-live. No new blocker specs filed.

---

## Notes

- The realtime channel reuse bug (StrictMode) was permanently fixed by centralising all subscriptions through `subscribePostgresChannel()` in `src/lib/realtime.ts`. The `import/first` ESLint rule prevents recurrence of mid-file imports.
- The onboarding cache bug was permanently fixed by replacing `profileReadyCache` (a module-level Map) with `useProfileReady()` (React Query backed, invalidated on `Welcome.tsx` success).
- Error boundaries are now in place at the route level (`RouteErrorBoundary`) so a broken page cannot black-screen the app.
