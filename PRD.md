# clingy — Product Requirements Document
**Version:** 1.1 (MVP shipped + group plans, edits, friendship, analytics)
**Status:** Living document — reflects production codebase
**Last updated:** 2026-06-19
**Live URL:** https://clingy-4-u.vercel.app/

> Formerly "Sticky Bridges." Product name is **clingy**; tagline **"make plans that stick."**

---

## 1. Vision

clingy is a mobile-first PWA (Capacitor-ready) that helps people make and keep plans to do things together in real life. Every plan is a piece of gum. Every completed plan forms a permanent bridge between two people. The app is a record of time spent together — not content consumed, not followers gained.

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
| Graph | `react-force-graph-2d` | Canvas 2D; export via 4:5 social card snapshot |
| OTP confirmation | Edge functions + ephemeral DB session | `start-confirmation` / `submit-confirmation` |
| Analytics | Anonymized event pipeline (opt-out) | `analytics_events` + `analytics.*` views + `track-events`; HMAC pseudonym, no PII |
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
status          enum: pending | active | removed
requested_by    uuid FK → users
snoozed_by_a    boolean DEFAULT false  -- user_a_id side muted this friend
snoozed_by_b    boolean DEFAULT false  -- user_b_id side muted this friend
created_at      timestamptz
accepted_at     timestamptz (nullable)
```
Rule: `user_a_id < user_b_id` always (DB constraint) to prevent duplicate rows. See section 11 (Friendship Management) for `removed` / snooze semantics.

### `gum_pieces`
One row per plan. Shared between members (see `gum_piece_members`).
```
id              uuid PK
creator_id      uuid FK → users
recipient_id    uuid FK → users  -- legacy 1:1 pointer; group membership lives in gum_piece_members
title           text (max 60 chars)
category        text (one of 7 slugs)
color_hex       text (derived from category at creation)
shape           text (randomized at creation: gum-strip | gum-ball | gum-chiclet | gum-block | gum-blob)
status          enum: placeholder | active | confirmed | expired | turned_down
planned_date    date (nullable)  -- optional date the plan is scheduled for; drives expires_at when set
pending_edit    jsonb (nullable) -- active-plan edit proposal awaiting member acceptance (section 6)
created_at      timestamptz
accepted_at     timestamptz (nullable)
expires_at      timestamptz  -- placeholder: created_at + 48hr; active: planned_date + 1 day if set, else accepted_at + 1yr
confirmed_at    timestamptz (nullable)
```
Note: `shape` is stored server-side; the UI currently renders category-colored CSS morph blobs (shape-specific SVG assets deferred).

### `gum_piece_members`
Membership rows for group plans. Backfilled for all existing pieces (creator + recipient).
```
id              uuid PK
gum_piece_id    uuid FK → gum_pieces (ON DELETE CASCADE)
user_id         uuid FK → auth.users
role            enum: creator | invitee
status          enum: pending | accepted | declined
invited_at      timestamptz DEFAULT now()
responded_at    timestamptz (nullable)
UNIQUE (gum_piece_id, user_id)
```
Creator row is always `accepted`. Invitees start `pending`. First invitee accept flips a placeholder piece to `active`. See section 5 (lifecycle) and section 7 (group plans).

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
Expired active pieces only (expiry without confirmation).
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
Ephemeral. Deleted after bridge forms or expiry. `REPLICA IDENTITY FULL` for realtime DELETE payloads.
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
In-app list. Email sent separately where noted in section 15.
```
id              uuid PK
user_id         uuid FK → users
type            enum (see section 15)
reference_id    uuid  -- gum_piece, post, bridge, connection, etc.
read            boolean DEFAULT false
actor_name      text (nullable)  -- denormalized actor display name at write time
actor_avatar_url text (nullable) -- denormalized actor avatar at write time
created_at      timestamptz
```

### `analytics_events`
Pseudonymized behavior store (section 12). RLS enabled with **no** policies — only service role (via `track-events`) can write; clients cannot read or write directly.
```
id          uuid PK
pseudonym   text  -- HMAC(user_id|install_id, ANALYTICS_SALT); not reversible, no FK
session_id  text  -- per app-open, client-generated
event_name  text  -- allowlisted enum (validated in edge fn)
surface     text (nullable) -- route/screen, e.g. 'piece_confirm'
props       jsonb DEFAULT '{}'  -- numbers/enums only; freetext > 64 chars rejected by trigger
platform    text (nullable) -- 'web' | 'ios' | 'android'
app_version text (nullable)
created_at  timestamptz
```

---

## 4. Slot Limits (enforced server-side)

- **Global per user:** 25 active slots (placeholders + active pieces combined)
- **Per pair:** 5 active slots (counted across `gum_piece_members` — plans where both users are members)
- Confirmed bridges and expired/rejected pieces do NOT occupy slots
- Slot check happens in `create-gum-piece` before insert and in `respond-gum-piece` on accept
- UI shows pocket counter (`X / 25`) and pair badges (`X / 5`) in creation flow

---

## 5. Gum Piece Lifecycle

```
1. Creator submits title (max 60 chars) + optional manual category override + optional planned_date + one or more recipients
2. Edge function: keyword match → category → color_hex assigned (override wins if valid)
3. Random shape assigned at creation
4. Slot check: creator has global slot, each pair has pair slot, active connection required
5. gum_piece created (status: placeholder), expires_at = now + 48hr;
   gum_piece_members inserted: creator (accepted) + each invitee (pending)
6. Each recipient gets invite_received notification (+ invite email)
7. An invitee accepts:
   → their member row: accepted; if piece was placeholder it flips to active,
     expires_at = planned_date + 1 day (if set) else accepted_at + 1yr; invite_accepted notification to creator
8. An invitee declines a placeholder:
   → their member row: declined (plan continues for other members)
9. Creator cancels placeholder:
   → status: turned_down, slots freed, plan_turned_down notification to all other members
10. 48hr passes with no response:
    → run-expiry sets status: expired, slots freed (no graveyard entry)
11. Either party turns down while active:
    → status: turned_down, slots freed, plan_turned_down notification (+ email)
12. Plan edit (active): proposer creates pending_edit; other accepted members accept;
    when all accept, edit applied (planned_date change updates expires_at). See section 6.
13. OTP confirmation:
    → initiator starts session via start-confirmation; 6-digit code, 5min expiry
    → both users submit via submit-confirmation
    → when both confirmed within window: status confirmed, bridge formed, draft post created, slots freed
14. expires_at passes without confirmation:
    → run-expiry sets status: expired, graveyard entry created, plan_expired notifications (+ email)
```

---

## 6. Plan Edit (`edit-gum-piece`)

Members can change a plan's `title`, `category`, and/or `planned_date` after creation. Actions: `propose`, `accept_edit`, `decline_edit`.

- **Placeholder edit:** only the creator may edit; changes apply **immediately** (no re-acceptance). Category change re-derives `color_hex`.
- **Active edit:** any accepted member proposes; the change is staged in `gum_pieces.pending_edit` (one proposal at a time). Every **other** accepted member must `accept_edit`; on the last acceptance the edit is applied and `pending_edit` cleared. Any member can `decline_edit`, which clears the proposal.
- A `planned_date` change on an active plan recomputes `expires_at` (planned_date + 1 day, or accepted_at + 1yr if cleared).
- Validation: title 1–60 chars; category must be a valid slug; planned_date within [yesterday, +1yr]; at least one field must change.
- Notifications: `plan_edit_proposed` (+ email) to other members on propose; `plan_edit_accepted` to all members when applied; `plan_edit_declined` to the proposer on decline.

---

## 7. Group Plans

A plan can have more than two members. `create-gum-piece` accepts `recipient_ids[]`; membership is tracked in `gum_piece_members` (creator `accepted`, invitees `pending`).

- First invitee acceptance flips a placeholder to `active`; remaining invitees can still accept or decline independently.
- Per-pair slot limit (5) is evaluated across membership rows.
- Creator cancel turns the whole plan down and notifies all other members; an individual invitee decline only marks that member `declined`.
- RLS on `gum_pieces` and `gum_piece_members` scopes visibility to members (migrations `20260617400000`, `20260619000000`). Atomic confirmed-member append RPC backs the confirmation path (`20260618000000`–`20260618000002`).

---

## 8. OTP Confirmation Flow

1. Either party taps **Mark as done** on an active gum piece
2. `start-confirmation` creates (or reuses) a `confirmation_session`: 6-digit code, 5min expiry; emits `confirmation_started`
3. Both users see the same code on `/piece/:id/confirm` (real-time via Supabase Realtime + React Query cache patches)
4. Both tap **Confirm** — each sets their flag in the session row
5. When both flags true AND within expiry: `submit-confirmation` forms bridge, runs unwrap ceremony, returns `draft_post_id`
6. If window expires with only one confirm: session cleaned up, piece stays active
7. Code is never shown in URL — in-app only

---

## 9. First Contact (Rotating QR)

1. User opens **Add someone** (`/add`) → `generate-qr-token` creates token with 60s TTL
2. QR encodes deep link: `/connect?token=xyz`
3. Other user scans (`/add/scan`) or opens link → `validate-qr-token`
4. Edge function validates (not expired, not own, not already connected, not duplicate pending) → pending connection
5. Recipient gets connection_request notification → accepts via `respond-connection` or ConnectionRequestSheet
6. On accept: connection status `active`, connection_accepted notification, network graph cache invalidated
7. Token is single-use. Expired QR shows actionable error copy.

Additional routes: `/connections/requests` for pending list; Network header menu also surfaces requests with badge count.

---

## 10. Categorization (Rule-based MVP)

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

On creation, user can override auto-detected category via `CategoryPicker`; server validates slug. Standalone `categorize-gum` edge function also exists for direct title → category lookups. Swap the categorize body for an LLM call later — the interface stays identical.

---

## 11. Friendship Management

From a friend's profile (`FriendshipMenu` → `useFriendshipActions` → RPCs):

- **Snooze / unsnooze** (`snooze_friend` / `unsnooze_friend`): per-side flags (`snoozed_by_a` / `snoozed_by_b`) mute that friend's activity for the snoozer only. Invalidates profile + feed caches.
- **Remove** (`remove_friend`): sets connection `status = removed`. Invalidates profile, feed, and network graph caches.
- A removed (or re-added) pair is handled by `validate-qr-token` so a past friend can reconnect via QR.

(Block / report — distinct from snooze/remove — is still deferred; see section 18.)

---

## 12. Analytics (anonymized, opt-out)

Three layers, privacy-safe, harness-agnostic. Full design in [`docs/ANALYTICS_LOOP.md`](docs/ANALYTICS_LOOP.md) and [`specs/analytics-insight-loop.md`](specs/analytics-insight-loop.md).

- **Layer 1 — views:** `analytics.*` SQL views over existing domain tables (`onboarding_funnel`, `piece_lifecycle`, `confirmation_funnel`, `category_popularity`, `engagement_summary`, `retention_cohorts`). Migration `20260619100000_analytics_views.sql`.
- **Layer 2 — events:** `analytics_events` table (HMAC pseudonym, no PII, props are numbers/enums only; a trigger rejects freetext > 64 chars). Written only by the `track-events` edge function (service role; allowlist + sanitizer + HMAC in `_shared/analytics.ts`). Client `src/lib/analytics.ts` (`AnalyticsSink` seam — `SupabaseSink` ships, `PostHogSink` stub) + `src/hooks/useTracker.ts`. Opt-out toggle in Settings ("Share anonymous usage data", default on); honors Do-Not-Track. Buffered/batched flush; never throws into UI.
- **Layer 3 — loop:** `supabase/scripts/insight-pack.sql` → any agent appends prioritized items to `BACKLOG.md`.

**Setup required:** `supabase secrets set ANALYTICS_SALT=<random>`, then deploy `track-events` and `supabase db push`.

---

## 13. Network Graph

**Library:** `react-force-graph-2d`

**Behaviour:**
- Nodes: users in your network (self at center with accent ring)
- Chalk spokes: always visible from you to each person with ≥1 bridge — thin lines, majority-category color, link distance scales with bridge count
- Gummy bridges: shown only when a node is selected — thick parallel lines per bridge, colored by category
- Physics: weak chalk attraction by default; on selection, strong pull between you and selected person; other nodes soft-pinned
- Interaction: drag nodes; tap node → `NodeProfileSheet`; tap bridge → `BridgeDetailSheet`
- Connections without bridges: nodes only, no chalk lines

**Export / share:** Available whenever graph has loaded (no node selection required). Composed **4:5 social card** (1080×1350) with stats footer, category glow, and grain — graph bitmap captured at 2× then framed via `buildSocialShareSnapshot` / `composeSocialShareCard`. Export-only zoom/label boost during capture; active selection cleared briefly so the PNG shows the chalk-spoke mesh. Native share sheet when supported; save/download fallback. Filename: `my-bridges-[YYYY-MM-DD].png`. (URL share disabled.)

**Header:** Combined actions menu (Add someone, Requests with badge). Connection requests page uses standard Back control.

---

## 14. Profile View

- **Gumball:** Organic multicolor blob (SVG patches proportional to bridge categories) — not a pie chart
- **Stat:** "chewed gum with N people" — unique bridged connections only
- **Bio:** Auto-generated via `generate-profile-bio` if null; editable in profile sheet
- **Avatar:** Upload with crop (`react-easy-crop`), 512px JPEG export; optional initials-only
- **Own profile header:** Graveyard icon (top-left) + Settings icon (top-right) — graveyard is NOT a bottom text link
- **Other profiles:** Shared bridges section; `FriendshipMenu` (snooze / remove); no access to their full network graph
- **No:** follower count, streak, join date prominently displayed

---

## 15. Feed, Graveyard, Screens, Notifications

### Feed
- Visible only to mutual connections (network-gated via RLS); snoozed friends hidden from the snoozer
- Draft post auto-created on bridge formation (`is_public = false`); user prompted in unwrap ceremony to publish or skip
- Published posts: activity title/body, category chip, date, participants
- Reactions (one per user, optimistic toggle) and comments only; no shares, reposts, or DMs; chronological, no algorithm
- Post detail in bottom sheet (`PostDetailSheet`)

### Graveyard
- Route: `/home/graveyard`; also reachable from graveyard icon on `/profile/me`
- Gum pieces that expired (active expiry) without confirmation; desaturated, humanized dates, read-only
- Excludes: rejected, turned-down, 48hr placeholder expiries

### Screens & Routes
```
Auth
  /                    Landing / sign in (drifting GumBlob physics, "clingy")
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
  /piece/new           Create plan (recipients + title + category + optional date)
  /piece/:id           Detail — accept, pass, cancel, mark as done, turn down, edit
  /piece/:id/confirm   OTP confirmation ceremony
Settings
  /settings            Account, notification toggles (localStorage), analytics opt-out, sign out
```
All authenticated routes wrapped in `AuthGuard`. Global `RouteErrorBoundary` with auth-aware **Try again** / **Go home** recovery (`src/lib/recoveryPath.ts`). App shell: centered device frame (max 430px), grain overlay, safe-area insets, visual viewport tracking.

### Notifications

| Type | In-app list | Email | Routes to |
|---|---|---|---|
| connection_request | ✓ | ✓ (invite flow) | ConnectionRequestSheet / `/connections/requests` |
| connection_accepted | ✓ | — | `/network` |
| invite_received | ✓ | ✓ | `/piece/:id` |
| invite_accepted | ✓ | — | `/piece/:id` |
| invite_rejected | ✓ | ✓ | `/piece/:id` |
| plan_turned_down | ✓ | ✓ | `/piece/:id` |
| plan_edit_proposed | ✓ | ✓ | `/piece/:id` |
| plan_edit_accepted | ✓ | — | `/piece/:id` |
| plan_edit_declined | ✓ | — | `/piece/:id` |
| confirmation_started | ✓ | — | `/piece/:id/confirm` |
| plan_expiring_soon | ✓ (when sent) | ✓ (when sent) | `/piece/:id` |
| plan_expired | ✓ | ✓ | `/piece/:id` |
| bridge_formed | ✓ | — | `/network` (node pre-selected) |
| post_comment | ✓ | — | `/feed` (post detail) |
| post_reaction | **Excluded from list** | — | N/A |

Emails sent via `send-email` → Resend API. Requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. `plan_expiring_soon` warnings emitted by `run-expiry` when an active piece expires within 30 days (idempotent per user per piece). Notifications carry denormalized `actor_name` / `actor_avatar_url`.

---

## 16. Edge Functions

| Function | Purpose |
|---|---|
| `generate-qr-token` | Create 60s rotating QR token |
| `validate-qr-token` | Validate scan / deep link; create pending connection |
| `respond-connection` | Accept pending connection |
| `create-gum-piece` | Create plan (group members, planned_date, slot checks, categorization, invite notification) |
| `respond-gum-piece` | Accept / decline / cancel plan (per-member) |
| `edit-gum-piece` | Propose / accept / decline a plan edit (title, category, date) |
| `categorize-gum` | Standalone title → category lookup |
| `start-confirmation` | Create OTP confirmation session |
| `submit-confirmation` | Validate OTP, form bridge, create draft post |
| `create-post` | Publish or update feed post from bridge |
| `toggle-reaction` | Add/remove reaction on post |
| `generate-profile-bio` | Auto-generate profile bio from bridge history |
| `run-expiry` | Expire placeholders/active pieces; 30-day `plan_expiring_soon` warnings; graveyard insert; session cleanup |
| `send-email` | Resend wrapper (service-role only) |
| `track-events` | Validate + pseudonymize + insert analytics events (service-role) |

15 functions total. **Config note:** `supabase/config.toml` currently registers only 13 — `edit-gum-piece` and `track-events` need `[functions.*]` entries added. All functions: `verify_jwt = false`; JWT validated manually via `auth.getUser(token)` (or service-role bearer for cron/email/analytics).

---

## 17. Implementation Status

| Area | Status |
|---|---|
| Auth + onboarding | ✅ Shipped (OAuth back-nav recovery, viewport-safe wizard, v2 landing physics) |
| QR connections | ✅ Shipped (incl. past-friend reconnect) |
| Gum lifecycle | ✅ Shipped |
| Group plans | ✅ Shipped (`gum_piece_members`, multi-recipient create, per-member accept) |
| Plan edit | ✅ Shipped (`edit-gum-piece`, pending_edit proposal flow) |
| OTP confirmation + bridges | ✅ Shipped (reworked ceremony) |
| Network graph + 4:5 social-card export | ✅ Shipped |
| Profiles + gumball + friendship menu | ✅ Shipped |
| Feed + reactions + comments | ✅ Shipped |
| Graveyard | ✅ Shipped |
| Email (Resend) | ✅ Shipped (invite, turn-down, edit, expiry) |
| Analytics pipeline | ✅ Shipped (needs `ANALYTICS_SALT` + deploy) |
| PWA manifest + Capacitor scaffold | ✅ Shipped |
| Production quality system | ✅ Shipped (`npm run quality`, skeletons, empty states, E2E smoke) |

---

## 18. Deferred (v2+)

- Bluetooth confirmation (requires Capacitor native build)
- Push notifications (requires Capacitor)
- Per-shape SVG gum assets (shape stored; UI uses CSS blobs today)
- LLM-based categorization
- Calendar / scheduling integration (planned_date is manual today)
- Animated gumball / network video export
- Report / block flow (`blocked_users` table not yet created) — distinct from shipped snooze/remove
- Rate limiting on sensitive endpoints (QR, OTP) — documented in rules, not yet enforced in DB
- PostHog analytics forwarding (`PostHogSink` is a stub)

---

## 19. Security Notes

- All slot checks server-side in edge functions
- RLS on all tables — policies in `supabase/week*-rls-policies.sql` and group/membership migrations; `analytics_events` has RLS on with no client policies
- OTP codes never in URLs
- Rotating QR tokens: single-use + 60s TTL
- No public user search — connections via QR only
- Feed and network gated to mutual connections
- Analytics: HMAC pseudonym (no reversible user id), no PII/freetext, opt-out + Do-Not-Track honored
- Service role key never exposed to client
- Avatar uploads to public `avatars` bucket with size-limited client-side export

---

*Operational flow status: `DEVDOC.md`. Design tokens and copy: `DESIGN.md`. Agent workflow: `AGENTS.md` + `.specify/memory/constitution.md`.*
</content>
</invoke>
