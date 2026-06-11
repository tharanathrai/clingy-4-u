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

---

## Notes

- The realtime channel reuse bug (StrictMode) was permanently fixed by centralising all subscriptions through `subscribePostgresChannel()` in `src/lib/realtime.ts`. The `import/first` ESLint rule prevents recurrence of mid-file imports.
- The onboarding cache bug was permanently fixed by replacing `profileReadyCache` (a module-level Map) with `useProfileReady()` (React Query backed, invalidated on `Welcome.tsx` success).
- Error boundaries are now in place at the route level (`RouteErrorBoundary`) so a broken page cannot black-screen the app.
