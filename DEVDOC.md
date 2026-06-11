# Sticky Bridges — Developer Documentation
**Version:** 0.3 (Production Quality System)
**Last updated:** 2026-05-26 — Network graph chalk spokes, share menu, header menu, export without selection

### Status vocabulary
- `Verified (automated)` — covered by a passing unit or E2E test in this repo
- `Verified (manual)` — tested manually in the last 7 days; entry in `docs/regression-matrix.md`
- `Broken` — known regression, must fix before ship
- `Not built` — spec exists but no code

---

## Flow status

### Auth
**Status: Verified (automated)** — E2E smoke test: unauthenticated access redirects to `/`
- What works: Google OAuth via Supabase, session persistence, auth state via singleton `useAuth` (module-level store + listeners), OAuth callback routing to `/welcome` vs `/home`, stored return path from `sessionStorage` for deep link flows.
- Components / hooks: `src/hooks/useAuth.ts`, `src/pages/Landing.tsx`, `src/pages/AuthCallback.tsx`

---

### Onboarding
**Status: Verified (automated)** — E2E smoke: unonboarded user stays on `/welcome`; `useProfileReady` unit tests 5/5 ✓; `markProfileReady` cache invalidation tested; `avatarImage.test.ts` 3/3 ✓
- What works: 3-step wizard (display name → username → avatar), real-time username availability check, circular avatar picker with zoom/crop (`react-easy-crop`) and 512px JPEG export, optional skip (initials only), upload to Supabase Storage `avatars` bucket via `uploadAvatar`, profile row creation in `public.users`, redirect to `/add` after completion. `profileReadyCache` Map replaced with `useProfileReady` React Query hook — onboarding loop is permanently fixed.
- Components / hooks: `src/pages/Welcome.tsx`, `src/hooks/useProfileReady.ts`, `src/components/profile/ProfileAvatarField.tsx`, `src/components/profile/AvatarCropSheet.tsx`, `src/hooks/useAvatarUpload.ts`, `src/lib/avatarImage.ts`

---

### QR Add / First Contact
**Status: Working**
- What works: `generate-qr-token` edge function creates 60s rotating tokens; QR displayed via `qrcode.react`; in-app scanner via `html5-qrcode`; deep link `/connect?token=` flow for sharing; `validate-qr-token` edge function validates token; all 5 error cases (expired, own, already_connected, request_pending, generic/network) handled with correct messages and actions (dismiss, retry, view profile); `AddScan.tsx` and `Connect.tsx` both have full error handling.
- Components / hooks: `src/pages/Add.tsx`, `src/pages/AddScan.tsx`, `src/pages/Connect.tsx`, `src/lib/validateQrToken.ts`

---

### Connection Requests
**Status: Verified (manual)** — last tested post React Query migration
- What works: Pending connection list with skeleton loading; accept/reject via `respond-connection` edge function; `ConnectionRequestSheet` used from notifications; `invalidateConnectionFlow` called on accept to update React Query cache for network graph + pending counter; toast feedback; real-time on connections table via `usePendingRequestCount` hook.
- Components / hooks: `src/pages/ConnectionRequests.tsx`, `src/components/connections/ConnectionRequestSheet.tsx`, `src/hooks/usePendingRequestCount.ts`, `src/lib/invalidate.ts`

---

### Gum Piece Creation
**Status: Verified (automated)** — `categorizeTitle` 11/11 unit tests ✓; E2E smoke: onboarded user lands on `/add`
- What works: Recipient selector with 5/5 pair-slot badges; title input with 60-char limit; live category preview via client-side `categorizeTitle`; submit via `useMutation` → `create-gum-piece` edge function; slot limit errors shown as toasts; success invalidates gum pieces cache via `queryKeys.gumPieces`; navigation to `/home`; skeleton loading rows for connections list.
- Components / hooks: `src/pages/PieceNew.tsx`, `src/lib/categorizeTitle.ts`, `src/components/gum/CategoryPicker.tsx`

---

### Pocket View
**Status: Working**
- What works: Full list of placeholder + active gum pieces sorted (placeholder first, then by `expires_at`); skeleton loading (3 cards); error state with retry; two empty states per DESIGN.md spec (no connections vs has connections); slot counter ("X / 25") visible in header; "Pocket full" tooltip on FAB; slot counter gating; new-gum FAB; real-time invalidation via Supabase channel → React Query invalidateQueries; pagination.
- Components / hooks: `src/pages/Home.tsx`, `src/hooks/useGumPieces.ts`, `src/components/gum/GumPieceCard.tsx`

---

### Invite Accept / Decline
**Status: Verified (manual)** — last tested post React Query migration; realtime now via `subscribePostgresChannel`
- What works: Piece detail loaded via React Query (`useQuery`); context-sensitive actions (accept/pass for recipient, cancel for creator, mark-as-done + turn-down for active); respond via `useMutation`; turn-down confirmation sheet; real-time subscription invalidates query via `subscribePostgresChannel`; expired invite shows "This invite has expired." on accept; skeleton loading screen.
- Components / hooks: `src/pages/PieceDetail.tsx`

---

### Confirmation Ceremony
**Status: Verified (manual)** — last tested post React Query migration; realtime via `subscribePostgresChannel`
- What works: `start-confirmation` creates OTP session; `submit-confirmation` validates and forms bridge on both confirms; real-time subscription via `useConfirmationSession` with direct React Query `setQueryData` updates via `subscribePostgresChannel`; OTP displayed with countdown timer; both-user confirm state tracked visually; expiry handling with "Try again" retry; bridge-formed detection via DELETE event; `UnwrapCeremony` animation with reduced-motion support; skeleton loading screen.
- Components / hooks: `src/pages/PieceConfirm.tsx`, `src/hooks/useConfirmationSession.ts`, `src/components/confirmation/OTPDisplay.tsx`, `src/components/confirmation/UnwrapCeremony.tsx`

---

### Bridge Formation
**Status: Verified (manual)** — server-side only; no client code to test directly
- Purely server-side in `submit-confirmation`. Bridge row inserted, notifications sent for both users, graveyard skipped for confirmed pieces, `draft_post_id` returned for post opt-in.

---

### Network Graph
**Status: Verified (automated)** — `networkPairSummary.test.ts`; quality gate; manual: chalk mesh, selection physics, share menu
- What works: Force-directed graph via `react-force-graph-2d`; nodes for self + all connections; chalk spokes always visible for bridged pairs (majority color, distance by bridge count); thick gummy bridge lines on node select; scoped selection physics with soft pin; `NodeProfileSheet` on node tap; `BridgeDetailSheet` on bridge tap; recenter button (round 44×44); share menu whenever graph has connections—no node selection required; export briefly clears selection so PNG includes full chalk mesh; header Add/Requests menu with request badge; `ConnectionRequests` uses standard Back button; error state with retry; empty state per DESIGN.md; real-time invalidation via `subscribePostgresChannel`; lazy-loaded chunk.
- Components / hooks: `src/pages/Network.tsx`, `src/components/network/NetworkGraph.tsx`, `src/components/network/GraphShareButton.tsx`, `src/components/network/NetworkHeaderMenu.tsx`, `src/lib/networkPairSummary.ts`, `src/lib/graphSnapshot.ts`, `src/hooks/useNetworkGraph.ts`, `src/hooks/usePendingRequestCount.ts`

---

### Profile (Own + Others)
**Status: Verified (automated)** — `avatarImage.test.ts` 3/3 ✓; avatar crop/upload shared with onboarding; edit save state fix verified 2026-05-26
- What works: Own profile with avatar, name, bio, gumball, category breakdown, graveyard icon button in header (top-left), edit sheet; auto-generates bio via `useMutation` → `generate-profile-bio` if null; other user profile with shared bridges section; correct redirect if viewing own username; `EditProfileSheet` with username availability check, circular avatar field (tap to change, crop sheet, remove photo sets `avatar_url` null); skeleton screen for loading state. Duplicate "settings →" link removed.
- Components / hooks: `src/pages/ProfileMe.tsx`, `src/pages/ProfileUser.tsx`, `src/hooks/useProfile.ts`, `src/components/profile/Gumball.tsx`, `src/components/profile/EditProfileSheet.tsx`, `src/components/profile/ProfileMeHeader.tsx`, `src/components/profile/ProfileAvatarField.tsx`, `src/components/profile/AvatarCropSheet.tsx`, `src/hooks/useAvatarUpload.ts`, `src/lib/avatarImage.ts`

---

### Feed
**Status: Verified (manual)** — last tested post React Query migration; realtime via `subscribePostgresChannel`
- What works: Feed posts from connected users + own posts; chronological order; skeleton loading (3 card skeletons); error state with retry; empty state with correct DESIGN.md copy; `FeedPostCard` with reactions, comments, author avatar; `PostDetailSheet` with comment list and composer; real-time via `subscribePostgresChannel` + React Query invalidation; optimistic reaction toggle via `useMutation` with `setQueryData` rollback; scroll position restoration; pagination.
- Components / hooks: `src/pages/Feed.tsx`, `src/hooks/useFeed.ts`, `src/hooks/usePost.ts`, `src/components/feed/FeedPostCard.tsx`, `src/components/feed/PostDetailSheet.tsx`

---

### Notifications
**Status: Verified (automated)** — E2E smoke: `/notifications` loads without subscribe() errors; `notifications.test.ts` 5/5 ✓
- What works: Notification list with unread count; real-time INSERT direct cache patch via `setQueryData`; real-time UPDATE patch in-place; all via `subscribePostgresChannel`; mark-as-read/mark-all/dismiss via optimistic `useMutation` with rollback; skeleton loading (4 rows); empty state ("All caught up."); error state with retry; routing to correct destination per type; `post_reaction` intentionally excluded (PRD section 14); `plan_expired` included in enrichNotifications gumPieceIds filter.
- Components / hooks: `src/pages/Notifications.tsx`, `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationItem.tsx`

---

### Settings
**Status: Verified (manual)** — last tested post skeleton loading addition
- What works: Account section (avatar, name, email, edit profile, sign out); notification toggles (localStorage only per spec); about section with version; skeleton loading screen.
- Components / hooks: `src/pages/Settings.tsx`

---

### Graveyard
**Status: Verified (manual)** — last tested post skeleton loading addition
- What works: List of expired-after-1-year gum pieces; desaturated styling; humanized dates; empty state with correct DESIGN.md copy; pagination; skeleton loading (3 card skeletons).
- Components / hooks: `src/pages/Graveyard.tsx`

---

## Architecture decisions

### 1. `useAuth` is a module-level singleton, not React Query
Auth state is stored in a module-level `authStore` with listeners. This is intentional — auth is a singleton concern that doesn't have a sensible React Query key until the user is known.

### 2. All custom hooks use React Query + centralised query key registry
All 10 custom data hooks (`useGumPieces`, `useNotifications`, `useFeed`, `usePost`, `useProfile`, `useBridges`, `useBridgesByPair`, `useNetworkGraph`, `useConfirmationSession`, `usePendingRequestCount`) use `useQuery` with keys from `src/lib/queryKeys.ts`. Mutations use `useMutation` with optimistic updates (`onMutate`), rollback (`onError`), and cache invalidation (`onSettled` or `onSuccess`). Cross-flow invalidations go through `src/lib/invalidate.ts`.

### 3. All realtime subscriptions via subscribePostgresChannel
Every `postgres_changes` subscription uses `subscribePostgresChannel()` from `src/lib/realtime.ts`. This guarantees:
- Unique channel name per effect (UUID suffix) → prevents StrictMode double-subscribe error
- All `.on()` bindings registered before `.subscribe()` is called
- Cleanup always calls `supabase.removeChannel`
- `useNotifications`: INSERT patches cache via `setQueryData` (prepend enriched item); UPDATE patches in-place
- `useConfirmationSession`: INSERT/UPDATE call `setQueryData` directly; DELETE fires `onBridgeFormed` callback + clears cache

### 4. `verify_jwt = false` in `supabase/config.toml`
All 12 edge functions manually validate the JWT by calling `supabase.auth.getUser(token)`. Intentional for error message flexibility.

### 5. Category logic duplicated client + server
`src/lib/categorizeTitle.ts` mirrors `supabase/functions/_shared/categorize.ts`. Client version used for live preview only. Edge function is canonical.

### 6. Graph export via direct canvas snapshot
Network graph export uses `captureGraphSnapshot()` in `src/lib/graphSnapshot.ts` (2× canvas draw, no `html2canvas`). Share/save does not require a selected node; `prepareGraphSnapshot` on `Network.tsx` clears selection before capture and restores afterward so exports show chalk spokes, not gummy bridge lines.

### 7. `submit-confirmation` auto-creates draft posts
On bridge formation, a `posts` row with `is_public = false` is created. The `draft_post_id` drives the post opt-in prompt in `UnwrapCeremony`.

### 8. `invalidateNetworkGraphCache` requires `queryClient` parameter
After React Query migration, `invalidateNetworkGraphCache(userId, queryClient)` requires both arguments. All callers (`ConnectionRequests.tsx`, `Notifications.tsx`, `ConnectionRequestSheet`) updated.

---

## WEEK7 checklist verification

### ✅ Verified by code
- `npm run typecheck` passes zero errors
- `npm run build` completes successfully (no chunk over 500kB; `react-force-graph-2d` in its own `Network` chunk; `html5-qrcode` in its own `AddScan` chunk)
- Skeleton screens: Home, Feed, Notifications, PieceDetail, PieceConfirm, ProfileMe, Settings, Graveyard, PieceNew, ConnectionRequests
- Empty states match DESIGN.md section 13 copy exactly for all screens
- Error states have retry buttons on all screens (Home, Feed, Network, Notifications, PieceDetail, Profile)
- Slot limit: pocket counter (X / 25) visible in Home header; "Pocket full" FAB tooltip; 5/5 pair badge in PieceNew
- QR edge cases: expired, own, already_connected, request_pending, network error — all handled with correct messages and actions
- Confirmation session edge cases: expired window, concurrent start, navigate-away, confirmed-elsewhere — all handled
- Expiry edge cases: piece expires on detail page → toast + redirect; invite expired notification → dismiss
- Safe area: `viewport-fit=cover` in index.html; `safe-content-bottom`, `safe-bottom-24` CSS classes used throughout
- Grain overlay: in `index.css`, applied to `div.grain-overlay` in `index.html`
- `@media (prefers-reduced-motion)` wraps all continuous animations (gumball shimmer, blob morph, feed entry)
- No hardcoded colors — Tailwind tokens only
- No `console.log` in committed frontend or edge function code
- `App.css` dead code deleted
- `PageStub.tsx` dead code deleted
- `public/manifest.json` exists with correct spec
- PWA meta tags in `index.html` (all present before this session)
- Capacitor config in `capacitor.config.ts`; `/ios` and `/android` in `.gitignore`
- `plan_expired` included in enrichNotifications filter (fixed this session)
- Connect page deep-link error handling improved (dismiss for expired/own, retry for generic)

---

## Known issues (post-session)

1. **`plan_expiring_soon` notifications on expired pieces** — if a user opens a `plan_expiring_soon` notification after the piece has expired, they're routed to `/piece/:id` which shows the expired piece. The UX is correct ("This one didn't happen. That's okay.") but the notification isn't dismissed automatically. Minor: would require an extra check on notification tap.

2. **Capacitor version skew** — `@capacitor/android`, `@capacitor/core`, `@capacitor/ios` are version 8.3.4 but `@capacitor/cli` is 7.6.5. `npx cap sync` will warn. Not blocking for scaffold-only goal.

3. **`useFeed` real-time is invalidation-based, not patch-based** — Any reaction, comment, or post insert triggers a full feed refetch via `invalidateQueries`. Granular `setQueryData` patches would eliminate flicker but require reconstructing the entire `FeedPost[]` shape from partial payloads. Acceptable tradeoff for now.

4. **Network error state triggers graph reset** — The "Retry" button in the Network error overlay sets `graphState.loading: true`, which causes the `NetworkGraph` component to re-render in loading state. The graph data is already in the React Query cache and will rehydrate immediately from `useNetworkGraph`. The visual reset is brief but noticeable. Cosmetic only.

5. **Profile cache key includes `viewerId`** — `useProfile` now uses the full `[identifier, byUserId ? 'id' : 'username', viewerId]` query key. This means the same profile fetched from two different views (by-id vs by-username) will be two separate cache entries. Acceptable since the data is identical and `staleTime: Infinity` prevents double-fetching.

---

## Flows needing manual testing

1. **Full core loop end-to-end** — Two real users: sign up → add each other via QR → create plan → accept → mark as done → OTP confirmation → bridge forms → appears in network graph → feed post opt-in.

2. **Real-time OTP sync** — Both users on the confirmation screen simultaneously on separate devices. Verify code appears on responder's screen without refresh. Verify both-confirmed state triggers unwrap ceremony simultaneously on both devices.

3. **PWA install** — Chrome on Android (Add to Home Screen), Safari on iOS (Add to Home Screen). Verify standalone display mode, theme color, icon display.

4. **Safe area insets on iPhone with notch / Dynamic Island** — Verify tab bar, floating FAB, bottom sheets all clear the home indicator. Check with `env(safe-area-inset-bottom)`.

5. **Email delivery** — Verify invite email received (check spam), turn-down email received, expiry email received. Requires `RESEND_API_KEY` (or SendGrid) set in Supabase edge function secrets.

6. **Avatar upload from Edit Profile sheet** — Tap circular avatar or “Change photo” → pick image → adjust zoom in crop sheet → “Use photo” → save → avatar URL updates (React Query cache invalidated). “Remove photo” clears `avatar_url` without deleting Storage objects.

7. **Graph share / export** — With no node selected, tap share → Save/Share produces `my-bridges-[YYYY-MM-DD].png` with chalk spokes + dark background. With a node selected, export still works and briefly shows chalk mesh in the PNG. Share opens native sheet on mobile when supported.

8. **Nightly cron expiry** — Manually call `run-expiry` after setting a piece's `expires_at` to the past. Verify: placeholder expires without graveyard entry; active piece expires with graveyard entry and both-user notifications of type `plan_expired`.

9. **Slot limits enforced server-side** — Verify that direct API calls to `create-gum-piece` beyond 25 global / 5 per-pair are blocked even without the UI restrictions. Verify RLS prevents reading other users' gum pieces.

10. **QR token expiry in the wild** — Scan a QR code after 60 seconds. Verify "This code has expired. Ask them to refresh." message with dismiss button.

11. **Confirmation session race condition** — Both users tap "Mark as done" simultaneously. Verify only one session is created (edge function deduplication) and both see the same OTP.

12. **Connection accepted real-time** — Accept a connection request on the ConnectionRequests page. Verify the network graph updates without a manual refresh (React Query cache invalidated via `invalidateNetworkGraphCache`).

13. **Notification routing** — Tap each notification type and verify navigation: `invite_received` → `/piece/:id`; `bridge_formed` → `/network` with node pre-selected; `connection_request` → ConnectionRequestSheet inline; `post_comment` → `/feed`.

14. **PostDetailSheet comment composer** — Open a post, add a comment, verify it appears in the list in real-time (React Query `usePost` invalidated by channel).
