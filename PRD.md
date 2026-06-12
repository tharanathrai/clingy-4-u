# Sticky Bridges — Product Requirements Document
**Version:** 1.0 (MVP shipped)  
**Status:** Living document — reflects production codebase  
**Last updated:** 2026-06-11  
**Live URL:** https://clingy-4-u.vercel.app/

---

## 1. Vision

Sticky Bridges (display name: **clingy 4 u**) is a mobile-first PWA (Capacitor-ready) that helps people make and keep plans to do things together in real life. Every plan is a piece of gum. Every completed plan forms a permanent bridge between two people. The app is a record of time spent together — not content consumed, not followers gained.

The design principle: **more friction on creation, zero friction on connection.** Plans require mutual acceptance. Completion requires physical presence (OTP ceremony). The network graph rewards consistency, not volume.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Lazy-loaded routes, device-frame shell |
| Styling | Tailwind CSS v4 | Tokens in `tailwind.config.js`; `@config` in `index.css` |
| Data fetching | TanStack React Query v5 | Optimistic mutations, central `queryKeys`, manual invalidation |
| Backend | Supabase | Auth, PostgreSQL, Realtime, Edge Functions, Storage |
| Auth | Supabase Auth (Google OAuth) | Module-level `useAuth` singleton (not React Query) |
| Real-time | Supabase Realtime | All subscriptions via `subscribePostgresChannel()` |
| Email | Resend via `send-email` edge function | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` secrets |
| Categorization | Rule-based keyword matching | Canonical: `supabase/functions/_shared/categorize.ts`; client mirror for live preview |
| Graph | `react-force-graph-2d` | Canvas 2D; export via direct canvas snapshot (2×) |
| OTP confirmation | Edge functions + ephemeral DB session | `start-confirmation` / `submit-confirmation` |
| Scheduled jobs | `run-expiry` edge function | Intended for pg_cron; cleans placeholders, active expiry, sessions |
| Mobile | Capacitor 8.x scaffold | `capacitor.config.ts`; native projects gitignored |
| Deploy | Vercel | Git-connected auto-deploy |
| Tests | Vitest (unit) + Playwright (E2E smoke) | Quality gate: `npm run quality` |

---

## 3. Data Model

Categories are **code-defined** (not a DB table). Seven slugs live in `src/lib/constants.ts` and `supabase/functions/_shared/categorize.ts`.

### `users`
```
id              uuid PK (matches auth.users)
display_name    text
username        text UNIQUE
avatar_url      text (nullable — Supabase Storage `avatars` bucket)
bio             text (nullable — auto-generated via generate-profile-bio if null)
created_at      timestamptz
```

### `connections`
Mutual friendship. Created once, shared by both users.
```
id              uuid PK
user_a_id       uuid FK → users
user_b_id       uuid FK → users
status          enum: pending | active
requested_by    uuid FK → users
created_at      timestamptz
accepted_at     timestamptz (nullable)
```
Rule: `user_a_id < user_b_id` always (DB constraint) to prevent duplicate rows.

### `gum_pieces`
One row per plan. Shared between two users.
```
id              uuid PK
creator_id      uuid FK → users
recipient_id    uuid FK → users
title           text (max 60 chars)
category        text (one of 7 slugs)
color_hex       text (derived from category at creation)
shape           text (randomized at creation: gum-strip | gum-ball | gum-chiclet | gum-block | gum-blob)
status          enum: placeholder | active | confirmed | expired | turned_down
created_at      timestamptz
accepted_at     timestamptz (nullable)
expires_at      timestamptz  -- created_at + 48hr for placeholder; accepted_at + 1yr for active
confirmed_at    timestamptz (nullable)
```
Note: `shape` is stored server-side; the UI currently renders category-colored CSS morph blobs (shape-specific SVG assets deferred).

### `bridges`
Formed when a gum_piece is confirmed. Permanent.
```
id              uuid PK
gum_piece_id    uuid FK → gum_pieces
user_a_id       uuid FK → users
user_b_id       uuid FK → users
category        text
color_hex       text
activity_title  text
formed_at       timestamptz
```

### `graveyard`
Expired active pieces only (1-year expiry without confirmation).
```
id              uuid PK
gum_piece_id    uuid FK → gum_pieces
user_a_id       uuid FK → users
user_b_id       uuid FK → users
title           text
category        text
color_hex       text
created_at      timestamptz
expired_at      timestamptz
```

### `confirmation_sessions`
Ephemeral. Deleted after bridge forms or expiry.
```
id              uuid PK
gum_piece_id    uuid FK → gum_pieces
otp_code        text (6 digits)
initiator_id    uuid FK → users
responder_confirmed boolean DEFAULT false
initiator_confirmed boolean DEFAULT false
expires_at      timestamptz  -- created_at + 5min
created_at      timestamptz
```

### `rotating_qr_tokens`
Ephemeral. Used for first contact.
```
id              uuid PK
user_id         uuid FK → users
token           text UNIQUE
expires_at      timestamptz  -- created_at + 60sec
```

### `posts`
Activity updates. Draft created on bridge formation; user opts in to publish.
```
id              uuid PK
bridge_id       uuid FK → bridges
author_id       uuid FK → users
body            text (auto-generated suggestion; user can edit; max 500 chars)
is_public       boolean  -- false = draft; true = visible in network feed
created_at      timestamptz
```

### `reactions`
```
id              uuid PK
post_id         uuid FK → posts
user_id         uuid FK → users
created_at      timestamptz
```
One row per user per post (unique constraint on post_id + user_id). Toggle via `toggle-reaction` edge function.

### `comments`
```
id              uuid PK
post_id         uuid FK → posts
user_id         uuid FK → users
body            text
created_at      timestamptz
```

### `notifications`
In-app list. Email sent separately where noted in section 14.
```
id              uuid PK
user_id         uuid FK → users
type            enum (see section 14)
reference_id    uuid  -- gum_piece, post, bridge, connection, etc.
read            boolean DEFAULT false
created_at      timestamptz
```

---

## 4. Slot Limits (enforced server-side)

- **Global per user:** 25 active slots (placeholders + active pieces combined)
- **Per pair:** 5 active slots
- Confirmed bridges and expired/rejected pieces do NOT occupy slots
- Slot check happens in `create-gum-piece` before insert and in `respond-gum-piece` on accept
- UI shows pocket counter (`X / 25`) and pair badges (`X / 5`) in creation flow

---

## 5. Gum Piece Lifecycle

```
1. Creator submits title (max 60 chars) + optional manual category override
2. Edge function: keyword match → category → color_hex assigned (override wins if valid)
3. Random shape assigned at creation
4. Slot check: creator has global slot, pair has pair slot, active connection required
5. gum_piece created (status: placeholder), expires_at = now + 48hr
6. Recipient gets invite_received notification (+ invite email)
7. Recipient accepts:
   → status: active, expires_at = accepted_at + 1yr, invite_accepted notification to creator
8. Recipient rejects (placeholder):
   → status: turned_down, slots freed, invite_rejected notification to creator (+ email)
9. Creator cancels placeholder:
   → status: turned_down, slots freed, plan_turned_down notification to recipient (not invite_rejected)
10. 48hr passes with no response:
    → run-expiry sets status: expired, slots freed (no graveyard entry)
11. Either party turns down while active:
    → status: turned_down, slots freed, plan_turned_down notification (+ email)
12. OTP confirmation:
    → initiator starts session via start-confirmation; 6-digit code, 5min expiry
    → both users submit via submit-confirmation
    → when both confirmed within window: status confirmed, bridge formed, draft post created, slots freed
13. 1yr passes without confirmation:
    → run-expiry sets status: expired, graveyard entry created, plan_expired notifications (+ email)
```

---

## 6. OTP Confirmation Flow

1. Either party taps **Mark as done** on an active gum piece
2. `start-confirmation` creates (or reuses) a `confirmation_session`: 6-digit code, 5min expiry
3. Both users see the same code on `/piece/:id/confirm` (real-time via Supabase Realtime + React Query cache patches)
4. Both tap **Confirm** — each sets their flag in the session row
5. When both flags true AND within expiry: `submit-confirmation` forms bridge, runs unwrap ceremony, returns `draft_post_id`
6. If window expires with only one confirm: session cleaned up, piece stays active
7. Code is never shown in URL — in-app only

---

## 7. First Contact (Rotating QR)

1. User opens **Add someone** (`/add`) → `generate-qr-token` creates token with 60s TTL
2. QR encodes deep link: `/connect?token=xyz`
3. Other user scans (`/add/scan`) or opens link → `validate-qr-token`
4. Edge function validates (not expired, not own, not already connected, not duplicate pending) → pending connection
5. Recipient gets connection_request notification → accepts via `respond-connection` or ConnectionRequestSheet
6. On accept: connection status `active`, connection_accepted notification, network graph cache invalidated
7. Token is single-use. Expired QR shows actionable error copy.

Additional routes: `/connections/requests` for pending list; Network header menu also surfaces requests with badge count.

---

## 8. Categorization (Rule-based MVP)

Seven categories with slug, label, color, and keyword lists in `_shared/categorize.ts`:

| Slug | Label | Color |
|---|---|---|
| intimate | Intimate | `#CF8EE8` |
| active | Active | `#7DD47A` |
| playful | Playful | `#F07868` |
| explore | Explore | `#6DB8F0` |
| recharge | Recharge | `#82C9A0` |
| savor | Savor | `#F0A84A` |
| support | Support | `#E89AA8` |

Scoring: lowercase title, keyword hits (multi-word phrases, exact word, prefix/substring), highest score wins. Ties broken by priority order (intimate → savor → active → … → explore). No match → explore.

On creation, user can override auto-detected category via `CategoryPicker`; server validates slug.

Swap the categorize function body for an LLM call later — the interface stays identical.

Standalone `categorize-gum` edge function also exists for direct title → category lookups.

---

## 9. Network Graph

**Library:** `react-force-graph-2d`

**Behaviour:**
- Nodes: users in your network (self at center with accent ring)
- Chalk spokes: always visible from you to each person with ≥1 bridge — thin lines, majority-category color, link distance scales with bridge count
- Gummy bridges: shown only when a node is selected — thick parallel lines per bridge, colored by category
- Physics: weak chalk attraction by default; on selection, strong pull between you and selected person; other nodes soft-pinned
- Interaction: drag nodes; tap node → `NodeProfileSheet`; tap bridge → `BridgeDetailSheet`
- Connections without bridges: nodes only, no chalk lines

**Export / share:** Available whenever graph has loaded (no node selection required). Captures chalk-spoke mesh; active selection cleared briefly during capture. Canvas PNG at 2× resolution. Native share sheet when supported; save/download fallback. Filename: `my-bridges-[YYYY-MM-DD].png`.

**Header:** Combined actions menu (Add someone, Requests with badge). Connection requests page uses standard Back control.

---

## 10. Profile View

- **Gumball:** Organic multicolor blob (SVG patches proportional to bridge categories) — not a pie chart
- **Stat:** "chewed gum with N people" — unique bridged connections only
- **Bio:** Auto-generated via `generate-profile-bio` if null; editable in profile sheet
- **Avatar:** Upload with crop (`react-easy-crop`), 512px JPEG export; optional initials-only
- **Own profile header:** Graveyard icon (top-left) + Settings icon (top-right) — graveyard is NOT a bottom text link
- **Other profiles:** Shared bridges section; no access to their full network graph
- **No:** follower count, streak, join date prominently displayed

---

## 11. Feed

- Visible only to mutual connections (network-gated via RLS)
- Draft post auto-created on bridge formation (`is_public = false`); user prompted in unwrap ceremony to publish or skip
- Published posts: activity title/body, category chip, date, both participants
- Reactions (one per user, optimistic toggle) and comments only
- No shares, reposts, or DMs
- Chronological. No algorithm.
- Post detail in bottom sheet (`PostDetailSheet`)

---

## 12. Graveyard

- Route: `/home/graveyard`; also reachable from graveyard icon on `/profile/me`
- Shows gum pieces that expired after 1 year without confirmation
- Visually desaturated; humanized dates
- Read only
- Does NOT include: rejected pieces, turned-down pieces, 48hr placeholder expiries

---

## 13. Screens & Routes

```
Auth
  /                    Landing / sign in ("clingy 4 u")
  /auth/callback       OAuth callback

Onboarding
  /welcome             3-step wizard → redirects to /add on complete

Core (tab bar: Pocket, Network, Feed, Notifications, Profile)
  /home                Pocket — active gum pieces
  /home/graveyard      Expired plans
  /network             Force graph
  /feed                Activity feed
  /notifications       In-app notification list
  /profile/me          Own profile
  /profile/:username   Other user's profile

Connections
  /add                 Rotating QR display
  /add/scan            In-app QR scanner
  /connect             Deep-link landing (?token=)
  /connections/requests Pending connection requests

Gum piece
  /piece/new           Create plan (recipient + title + category)
  /piece/:id           Detail — accept, pass, cancel, mark as done, turn down
  /piece/:id/confirm   OTP confirmation ceremony

Settings
  /settings            Account, notification toggles (localStorage), sign out
```

All authenticated routes wrapped in `AuthGuard`. Global `RouteErrorBoundary` with auth-aware **Try again** / **Go home** recovery (`src/lib/recoveryPath.ts`).

App shell: centered device frame (max 430px), grain overlay, safe-area insets, visual viewport tracking for mobile browser chrome.

---

## 14. Notifications

| Type | In-app list | Email | Routes to |
|---|---|---|---|
| connection_request | ✓ | ✓ (invite flow) | ConnectionRequestSheet / `/connections/requests` |
| connection_accepted | ✓ | — | `/network` |
| invite_received | ✓ | ✓ | `/piece/:id` |
| invite_accepted | ✓ | — | `/piece/:id` |
| invite_rejected | ✓ | ✓ | `/piece/:id` |
| plan_turned_down | ✓ | ✓ | `/piece/:id` |
| plan_expiring_soon | ✓ (when sent) | ✓ (when sent) | `/piece/:id` |
| plan_expired | ✓ | ✓ | `/piece/:id` |
| bridge_formed | ✓ | — | `/network` (node pre-selected) |
| post_comment | ✓ | — | `/feed` (post detail) |
| post_reaction | **Excluded from list** | — | N/A |

Emails sent via `send-email` → Resend API. Requires Supabase secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

**Not yet implemented:** `plan_expiring_soon` generation (schema + UI support exist; `run-expiry` does not yet emit 30-day warnings).

---

## 15. Edge Functions

| Function | Purpose |
|---|---|
| `generate-qr-token` | Create 60s rotating QR token |
| `validate-qr-token` | Validate scan / deep link; create pending connection |
| `respond-connection` | Accept pending connection |
| `create-gum-piece` | Create plan with slot checks, categorization, invite notification |
| `respond-gum-piece` | Accept or turn down / cancel plan |
| `categorize-gum` | Standalone title → category lookup |
| `start-confirmation` | Create OTP confirmation session |
| `submit-confirmation` | Validate OTP, form bridge, create draft post |
| `create-post` | Publish or update feed post from bridge |
| `toggle-reaction` | Add/remove reaction on post |
| `generate-profile-bio` | Auto-generate profile bio from bridge history |
| `run-expiry` | Expire placeholders/active pieces; graveyard insert; session cleanup |
| `send-email` | Resend wrapper (service-role only) |

All functions: `verify_jwt = false` in config; JWT validated manually via `auth.getUser(token)`.

---

## 16. Implementation Status (MVP)

| Area | Status |
|---|---|
| Auth + onboarding | ✅ Shipped (incl. OAuth back-nav recovery, viewport-safe wizard) |
| QR connections | ✅ Shipped |
| Gum lifecycle | ✅ Shipped |
| OTP confirmation + bridges | ✅ Shipped |
| Network graph + export | ✅ Shipped |
| Profiles + gumball | ✅ Shipped (graveyard header icon) |
| Feed + reactions + comments | ✅ Shipped |
| Graveyard | ✅ Shipped |
| Email (Resend) | ✅ Shipped (invite, turn-down, expiry) |
| PWA manifest + Capacitor scaffold | ✅ Shipped |
| Production quality system | ✅ Shipped (`npm run quality`, skeletons, empty states, E2E smoke) |
| Post-MVP audit + completion plan | ✅ Documented — see [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (spec `008`); P1 queue: `009`–`012` |

---

## 17. Deferred (v2+)

- Bluetooth confirmation (requires Capacitor native build)
- Push notifications (requires Capacitor)
- `plan_expiring_soon` cron (30-day warning emails/notifications)
- Per-shape SVG gum assets (shape stored; UI uses CSS blobs today)
- LLM-based categorization
- Group plans (3+ people)
- Calendar / scheduling integration
- Animated gumball / network video export
- Social-first graph export preset (see BACKLOG.md)
- Report / block flow (`blocked_users` table not yet created)
- Rate limiting on sensitive endpoints (QR, OTP) — documented in rules, not yet enforced in DB

---

## 18. Security Notes

- All slot checks server-side in edge functions
- RLS on all tables — policies in `supabase/week*-rls-policies.sql`
- OTP codes never in URLs
- Rotating QR tokens: single-use + 60s TTL
- No public user search — connections via QR only
- Feed and network gated to mutual connections
- Service role key never exposed to client
- Avatar uploads to public `avatars` bucket with size-limited client-side export

---

*Operational flow status: `DEVDOC.md`. Design tokens and copy: `DESIGN.md`. Agent workflow: `AGENTS.md` + `.specify/memory/constitution.md`.*
