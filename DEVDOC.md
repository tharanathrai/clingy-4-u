# Clingy 4 U — Developer Documentation

Living snapshot of implementation status as of code review (PRD v0.1, DESIGN v0.1). Status labels reflect what the source shows, not live QA.

---

## Current state

### Auth

- **Status:** Partially working (Google OAuth only — intentional scope)
- **What works**
  - Google OAuth via `useAuth` → `signInWithOAuth` with redirect to `/auth/callback`
  - `AuthCallback` checks `users` row and routes to `/welcome` or `/home` (or `sessionStorage` return path for `/connect`)
  - `AuthGuard` blocks unauthenticated routes, redirects incomplete profiles to `/welcome`, completed profiles away from `/welcome` to `/add`
  - Session persisted through Supabase; module-level auth store dedupes listeners across components
- **Known gaps / bugs**
  - Signed-in users hitting `/` go to `/home`, not `/add` (DESIGN says onboarding should land on add screen)
  - No explicit handling of OAuth error query params on Landing (`/?error=...`)
- **Components / hooks:** `pages/Landing.tsx`, `pages/AuthCallback.tsx`, `hooks/useAuth.ts`, `components/layout/AuthGuard.tsx`

### Onboarding

- **Status:** Partially working
- **What works**
  - 3-step Welcome: display name, username (debounced availability), optional avatar upload to `avatars` bucket
  - Inserts `users` row; navigates to `/add` on success
  - `AuthGuard` enforces profile row before tabbed app
- **Known gaps / bugs**
  - Username check is client-side only (race if two users pick same name simultaneously)
  - No server-side bio generation on Welcome (bio auto-gen runs later on Profile Me)
  - Avatar upload uses `upsert: false` — re-onboarding with new file could fail if path collides
- **Components / hooks:** `pages/Welcome.tsx`, `hooks/useAuth.ts`, `components/layout/AuthGuard.tsx`

### QR add (rotating QR + scan)

- **Status:** Working
- **What works**
  - **Display:** `Add` calls `generate-qr-token` edge function; 60s TTL; countdown ring; sessionStorage cache; auto-refresh on expiry
  - **Scan:** `AddScan` uses `html5-qrcode`; parses `/connect?token=` or raw token; calls `validate-qr-token`
  - **Deep link:** `Connect` supports unauthenticated → sign-in with token preserved in `sessionStorage`; auto-submits when signed in
  - Edge function enforces expiry, own-QR, duplicate active/pending handling; consumes token; creates `pending` connection
  - On successful request creation, `validate-qr-token` now inserts `connection_request` notification for the QR owner and sends email via `send-email`
  - Scanner UI now handles a dedicated `request_pending` error path
- **Known gaps / bugs**
  - PRD domain `stickybridges.app`; QR uses `window.location.origin`
  - `generate-qr-token` not reviewed here for duplicate-token / force behavior beyond client `force` flag
- **Components / hooks:** `pages/Add.tsx`, `pages/AddScan.tsx`, `pages/Connect.tsx`, `supabase/functions/generate-qr-token`, `supabase/functions/validate-qr-token`

### Connection requests (accept / decline)

- **Status:** Working
- **What works**
  - `ConnectionRequests` lists incoming `pending` connections (where `requested_by !== self`)
  - Accept/decline now call `respond-connection` edge function (service-role path): accept activates connection + sends `connection_accepted`; decline deletes pending row and cleans stale `connection_request` notifications
  - Paginated list via `usePaginatedItems`
  - Explicit loading, error (retry), empty, and happy states
- **Known gaps / bugs**
  - No dedicated tab entry for requests; discovery remains notification-driven or direct route
- **Components / hooks:** `pages/ConnectionRequests.tsx`, `hooks/useAuth.ts`, `hooks/usePaginatedItems.ts`

### Gum piece creation

- **Status:** Partially working
- **What works**
  - `PieceNew` picks active connection, title (60 chars), client-side `categorizeTitle` preview + `CategoryPicker` override
  - Submits to `create-gum-piece` edge function: server categorization, **slot limits** (25 global / 5 per pair), random `shape` stored in DB
  - Success toast via navigation state to Home
  - Pair slot usage and bridge strength shown in recipient picker
- **Known gaps / bugs**
  - Client `useGumPieces` / `GumPiece` types **omit `shape`** — pocket UI uses CSS morph blobs, not stored SVG shapes (AGENTS.md gum assets unused in list/detail)
  - Home “pocket full” uses `pieces.length >= 25` client-side; server is authoritative but UI may drift until refetch
  - `categorizeTitle.ts` (client) and `_shared/categorize.ts` (server) must stay in sync manually
- **Components / hooks:** `pages/PieceNew.tsx`, `components/gum/CategoryPicker.tsx`, `lib/categorizeTitle.ts`, `lib/constants.ts`, `hooks/useAuth.ts`

### Invite accept / decline (gum piece)

- **Status:** Partially working
- **What works**
  - Recipient sees `placeholder` on pocket; `PieceDetail` accept/pass via `respond-gum-piece`
  - Creator can cancel placeholder (turn_down)
  - Active piece: turn down with confirm; link to confirm flow
  - Realtime refresh on `gum_pieces` postgres changes
  - Server sets `active` + 1yr expiry on accept; notifications `invite_received` / `invite_accepted` / `invite_rejected` / `plan_turned_down`; turn-down emails via `send-email`
- **Known gaps / bugs**
  - Accept slot re-check on server can fail after invite sent (recipient sees invite but accept returns `slot_limit_*`)
  - Expired placeholder handling shows toast “invite has expired” on `invalid_status` only
  - No dedicated “reject” copy distinction beyond pass/cancel in all cases
- **Components / hooks:** `pages/PieceDetail.tsx`, `pages/Home.tsx`, `components/gum/GumPieceCard.tsx`, `hooks/useGumPieces.ts`, `supabase/functions/respond-gum-piece`

### Confirmation ceremony (OTP)

- **Status:** Partially working
- **What works**
  - `PieceConfirm` loads active piece; joins/creates session via `start-confirmation` or existing row
  - `useConfirmationSession` realtime on `confirmation_sessions` INSERT/UPDATE/DELETE
  - `OTPDisplay` shows shared code, countdown, per-party confirm chips; submits to `submit-confirmation`
  - On both confirmed: bridge + gum `confirmed`, session deleted, draft post created, `UnwrapCeremony` animation + publish/skip
  - Fallback polling for bridge if session delete races realtime
- **Known gaps / bugs**
  - **`start-confirmation` sets `initiator_confirmed: true` on create** — user who taps “Mark as done” is auto-confirmed; only partner must tap (differs from PRD “both tap confirm” symmetrically)
  - Initiator/responder flags are session roles, not creator/recipient — UI maps via `isInitiator`
  - RLS may block client read of `confirmation_sessions` (code comments note fallback via edge function only)
  - OTP passed in request body to `submit-confirmation` (in-app only per PRD — OK)
- **Components / hooks:** `pages/PieceConfirm.tsx`, `components/confirmation/OTPDisplay.tsx`, `components/confirmation/UnwrapCeremony.tsx`, `hooks/useConfirmationSession.ts`, `supabase/functions/start-confirmation`, `supabase/functions/submit-confirmation`

### Bridge formation

- **Status:** Partially working
- **What works**
  - Created in `submit-confirmation` when both flags true: `bridges` row, `gum_pieces.status = confirmed`, notifications `bridge_formed` for both users
  - Draft `posts` row (`is_public: false`) per confirming user; publish via `create-post` or skip updates draft
  - `PieceDetail` realtime redirect if piece becomes `confirmed` while away
- **Known gaps / bugs**
  - Idempotent bridge creation retries if duplicate insert races
  - Feed may not update until refetch/realtime on `posts` table
- **Components / hooks:** `supabase/functions/submit-confirmation`, `supabase/functions/create-post`, `components/confirmation/UnwrapCeremony.tsx`, `hooks/useBridges.ts` (if used elsewhere)

### Network graph

- **Status:** Partially working
- **What works**
  - `react-force-graph-2d` with nodes for self + active connections; avatars on canvas; collision; mobile pointer boost
  - **Edges hidden until node selected** — only bridges between self and selected node (`linkVisibility`)
  - Bridge weight affects link width; parallel bridges between same pair supported
  - `BridgeDetailSheet`, `NodeProfileSheet` (profile preview, create plan), recenter, PNG export (canvas snapshot, not html2canvas)
  - Empty states for no connections / no bridges
- **Known gaps / bugs**
  - Graph data cached in `useNetworkGraph` until manual `refetch` — new bridges/connections may stale until remount
  - PRD physics “more bridges = closer nodes” — implementation uses link width, not clearly stronger link force by count
  - `html2canvas` dependency unused for export
- **Components / hooks:** `pages/Network.tsx`, `components/network/NetworkGraph.tsx`, `components/network/BridgeDetailSheet.tsx`, `components/network/NodeProfileSheet.tsx`, `hooks/useNetworkGraph.ts`, `hooks/useBridgesByPair.ts`

### Feed

- **Status:** Partially working
- **What works**
  - `useFeed`: own posts + connections’ `is_public` posts; chronological; reactions count + `hasReacted`
  - `FeedPostCard`, `PostDetailSheet` with comments; `toggle-reaction` edge function
  - Optimistic reaction toggle; realtime subscription on posts/reactions/comments
  - Scroll restore + pagination
- **Known gaps / bugs**
  - Optimistic reactions **not rolled back** on `toggle-reaction` failure
  - Post comment/reaction notifications depend on edge function inserts (not fully traced in client)
  - No post deep-link from notification (navigates to `/feed` only)
  - Draft/skipped posts: private posts from other users not shown (by design)
- **Components / hooks:** `pages/Feed.tsx`, `components/feed/FeedPostCard.tsx`, `components/feed/PostDetailSheet.tsx`, `hooks/useFeed.ts`, `hooks/usePost.ts`, `supabase/functions/toggle-reaction`

### Profile

- **Status:** Partially working
- **What works**
  - **Me:** `ProfileMe` — avatar, bio, `Gumball` from bridge category breakdown, “chewed gum with N people” (unique partners), category bars, edit sheet, graveyard link, auto `generate-profile-bio` if empty
  - **Other:** `ProfileUser` — same public stats; `SharedBridgesSection` when connected; “Add someone” CTA when not connected
  - `useProfile` caches by viewer+target; shared bridges gated on active connection
- **Known gaps / bugs**
  - Non-connected viewers can still load profile by username (PRD: network visibility — RLS assumed)
  - Gumball is patch-style SVG, not full wrapped/unwrapped gum shapes
  - `connectionCount` is unique bridge partners, not same as “active connections” count
  - `/profile` route re-exports `ProfileUser` (no separate stub)
- **Components / hooks:** `pages/ProfileMe.tsx`, `pages/ProfileUser.tsx`, `components/profile/Gumball.tsx`, `components/profile/SharedBridgesSection.tsx`, `components/profile/EditProfileSheet.tsx`, `hooks/useProfile.ts`, `supabase/functions/generate-profile-bio`

### Notifications

- **Status:** Partially working
- **What works**
  - In-app list with unread styling, mark read / mark all read, dismiss (delete row)
  - Enrichment: actor name/avatar from gum piece, bridge, or connection reference (including `connection_accepted`)
  - Realtime INSERT/UPDATE; badge on tab bar
  - Navigation: gum types → piece; `connection_request` opens `ConnectionRequestSheet`; `connection_accepted`/`bridge_formed` navigate to network with selected user; post types → feed
  - Expired invite tap dismisses + toast
  - Notifications page now has explicit loading, error, empty, and happy states
- **Known gaps / bugs**
  - `plan_expiring_soon` / `plan_expired` types exist in schema but cron/email integration not verified in client
  - Email prefs in Settings are localStorage only — **not wired** to `send-email`
- **Components / hooks:** `pages/Notifications.tsx`, `components/notifications/NotificationItem.tsx`, `hooks/useNotifications.ts`

### Settings

- **Status:** Partially working
- **What works**
  - Account summary, edit profile sheet, sign out
  - Email notification toggles persisted in `localStorage` (`notif_email_invite`, `notif_email_expiry`)
  - About version string
- **Known gaps / bugs**
  - Toggles do not affect server/email sending
  - No push notification settings (deferred v2)
  - No link to connection requests or graveyard (graveyard on Profile Me only)
- **Components / hooks:** `pages/Settings.tsx`, `hooks/useAuth.ts`, `hooks/useProfile.ts`, `components/profile/EditProfileSheet.tsx`

### Graveyard

- **Status:** Partially working
- **What works**
  - Lists `graveyard` rows for user; desaturated styling; partner name; created/expired relative times
  - Populated by `run-expiry` for 1yr active expiries (server)
- **Known gaps / bugs**
  - Read-only; no link from Home pocket (only profile me)
  - Depends on cron/scheduled invocation of `run-expiry` (not in frontend)
- **Components / hooks:** `pages/Graveyard.tsx`, `hooks/useAuth.ts`, `supabase/functions/run-expiry`

### Pocket (Home)

- **Status:** Partially working
- **What works**
  - Lists `placeholder` + `active` gum via `useGumPieces`; sorted placeholders first; realtime; pagination
  - Empty states per DESIGN (no connections vs no pieces)
  - Floating “new gum” CTA with slot-full disable
- **Known gaps / bugs**
  - See gum shape / slot count issues above
  - No pull-to-refresh (retry button on error only)
- **Components / hooks:** `pages/Home.tsx`, `components/gum/GumPieceCard.tsx`, `hooks/useGumPieces.ts`, `components/layout/Layout.tsx`

---

## Architecture decisions

| Decision | Rationale |
|----------|-----------|
| **Module-level auth store** (`useAuth`) | Single Supabase subscription shared across all consumers; avoids duplicate `onAuthStateChange` listeners and flicker. |
| **Per-feature in-memory caches** (`gumPiecesCache`, `feedCache`, `networkGraphCache`, `profileCache`, `notificationsCache`) | Faster tab switches on mobile; tradeoff is stale data until realtime event or manual `refetch`. |
| **Edge functions with service role for mutations** | Slot limits, QR validation, confirmation, and categorization cannot be bypassed via client; RLS stays strict on anon/authenticated clients. |
| **Client `categorizeTitle` + server `_shared/categorize.ts`** | Instant UI feedback on Piece New; server re-resolves/overrides on create for trust. |
| **`start-confirmation` auto-confirms initiator** | Reduces taps for user who opened confirm screen; second party is `responder_confirmed`. Documented here because it diverges from symmetric PRD wording. |
| **Confirmation realtime + DELETE bridge detection** | `useConfirmationSession` treats session DELETE as bridge-formed signal; `PieceConfirm` polls `bridges` as fallback. |
| **Network graph edge visibility** | Only self↔selected node links rendered — keeps default view uncluttered per DESIGN. |
| **Feed merges own + network public posts client-side** | Avoids single complex RLS view; author always sees own drafts/private posts in hook query. |
| **QR token cache in sessionStorage** | Prevents token churn on Add page remount; force refresh clears cache. |
| **AuthGuard routes completed users to `/add` not `/home`** | Matches DESIGN “onboarding ends at add screen”. |
| **Capacitor deps present** | Scaffold for v2 native; web-first PWA remains primary. |
| **Typed `Database` in `lib/supabase.ts`** | Client queries typed; may lag migrations (e.g. `shape` on `gum_pieces` in functions but not in generated types). |

---

## Known issues

### Critical / product-breaking (code-evident)

1. **Connection requests depend on runtime DB policy parity** — this repo includes Week 7 migration for `connection_accepted`, but production still requires SQL to be applied before the new notification type is valid.
2. **Notification dismiss still depends on delete policies** — if `notifications` DELETE is not allowed in deployed RLS, dismiss calls will fail silently in client hooks.

### Data model / type drift

4. **`gum_pieces.shape` written server-side, not modeled in client `Database` or `GumPiece`** — SVG gum assets unused in pocket/detail.
5. **PRD category slugs in older PRD table (`outdoors`, `food`) vs app `CATEGORIES` (intimate, active, …)** — PRD §8 example is outdated relative to `constants.ts`.

### Auth & onboarding

6. **Landing redirects authenticated users to `/home`**, bypassing DESIGN-first `/add` for returning sessions.

### Gum lifecycle

7. **Client pocket full check** may disagree with server until refetch.
8. **Accept after slots filled** — invitee can receive invite but fail accept with slot errors.
9. **`start-confirmation` auto-sets `initiator_confirmed: true`** — asymmetric confirm flow.

### Notifications & email

10. **Settings email toggles are localStorage only** — `send-email` / invite / turn-down emails ignore them.
11. **`plan_expiring_soon` notification** — type exists; client copy exists; cron behavior not visible in `src/`.
12. **Post notification navigation** — comment/reaction opens feed, not specific post.

### Feed & social

13. **Reaction optimistic UI without rollback** on API failure.
14. **Feed cache** may show stale counts until realtime fires.

### Network & graph

15. **Network graph cache** — new bridge may not appear until refresh/refetch.
16. **Export uses canvas draw**, not `html2canvas` (dependency unused).

### Realtime & RLS

17. **Confirmation session client SELECT** may fail under RLS; relies on edge function + realtime.
18. **Broad realtime on `gum_pieces`** without filter — all piece changes trigger refetch for user channel.

### Misc

19. **`console.error` in `respond-gum-piece`** edge function (AGENTS.md says no console.log in committed code — server-side exception).
20. **`PageStub` component** unused in routes (dead code).
21. **Profile `connectionCount`** counts unique bridge partners, not active connection count — label can confuse.
22. **validate-qr-token** does not notify token owner (QR display user) that someone scanned — only scanner sees success.

---

## Flows needing manual testing

These cannot be confirmed from static review alone:

| Flow | Why manual |
|------|------------|
| End-to-end Google OAuth on production redirect URLs | Depends on Supabase/Vercel env and cookie behavior |
| Avatar upload + Storage RLS policies | Bucket rules not in `src/` |
| QR scan iOS/Android camera permissions | `html5-qrcode` browser differences |
| QR 60s expiry + single-use under concurrent scans | Race between two scanners |
| Connection request → notification → accept → both see active connection | Notification insert gap may block discovery |
| Gum create at 24/25 and 4/5 pair slots | Server errors + UI messages |
| Placeholder 48h expiry via `run-expiry` cron | Requires scheduled job + service role call |
| Active 1yr expiry → graveyard row | Cron + graveyard UI |
| `plan_expiring_soon` emails/notifications 30 days before expiry | Cron/trigger not in frontend |
| Full OTP confirm with two devices / two accounts | Realtime latency, session DELETE, bridge poll |
| Confirm expire at 5m with one party confirmed | Session cleanup + retry |
| Bridge formation → UnwrapCeremony → post / skip → feed visibility | Multi-step + RLS on posts |
| Network graph select node → multiple bridge lines → bridge detail | Canvas hit testing on mobile |
| Graph PNG export on Safari / mobile | Canvas CORS/taint with avatars |
| Feed reaction double-tap / offline | Optimistic rollback |
| Profile view as non-connected vs connected user | RLS policies in `week5-rls-policies.sql` etc. |
| Email delivery (invite, turn-down) via SendGrid | `send-email` secrets and provider |
| `generate-profile-bio` output quality | Edge function + update permissions |
| AuthGuard `/welcome` vs `/add` with slow network | Profile check race on first login |
| Deep link `/connect?token=` cold start | sessionStorage + OAuth return |
| Settings email toggles | Confirm they do nothing server-side today |
| Capacitor build (if used) | Native shell not exercised in web-only review |

---

## Changelog

### 2026-05-22 — Auth scope: Google only

**Scope:** Documentation and planning only. Auth code was already Google-only (`useAuth.signInWithGoogle`, `Landing`, `Connect`).

**Changes:**
- `PRD.md` Week 1 shipping plan: Google OAuth only.
- `WEEK1_TASKS.md`: Auth tasks and snapshot aligned with Google-only implementation.
- `DEVDOC.md`: Removed stale auth-provider gap entries; renumbered known issues.

**Auth flow trace (verified by reading code):**

| Step | Layer |
|------|--------|
| User taps "Sign in with Google" | `Landing.tsx` / `Connect.tsx` |
| `signInWithGoogle()` | `useAuth.ts` → `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: origin + '/auth/callback' })` |
| OAuth provider redirect | Supabase Auth (no edge function) |
| Return to app | `AuthCallback.tsx` → `getUser()` → `users` profile lookup |
| Route decision | No profile → `/welcome`; profile + `sessionStorage` return path → stored path; else profile → `/home` |
| Protected app | `AuthGuard.tsx` → profile check → `/welcome` or `/add` (if on welcome with profile) |

**Regression surface (shared auth pieces):**
- `useAuth`: `Landing`, `Connect`, `Settings`, `AuthGuard`, and any page using sign-out
- `AuthCallback`: all OAuth returns (including Connect deep link via `postAuthReturnTo` session key)
- `AuthGuard`: all routes under authenticated layout

**Four-state check (auth-related pages):**

| Page | Loading | Error | Empty | Happy |
|------|---------|-------|-------|-------|
| `Landing` | Session check spinner | Sign-in catch → playful message | N/A | Google CTA |
| `AuthCallback` | Spinner + copy | Redirect `/?error=...` (Landing does not display it yet) | N/A | Auto-navigate |
| `Connect` | Session / submit loading | `connectIssue` panel + CTAs | Missing token message | Success card + auto-nav |

**Flows needing manual testing (unchanged):** Google OAuth on production redirect URLs; deep link `/connect?token=` cold start.

---

*Update this file after each sprint when behavior changes. Do not treat “Not tested” as “Broken” — run the manual flows above to upgrade status.*
