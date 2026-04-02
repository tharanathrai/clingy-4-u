# Sticky Bridges — Product Requirements Document
**Version:** 0.1 (Pre-build)  
**Status:** Living document — updated after each weekly sprint  
**Last updated:** Pre-sprint 0

---

## 1. Vision

Sticky Bridges is a mobile-first web app (PWA, Capacitor-ready) that helps people make and keep plans to do things together in real life. Every plan is a piece of gum. Every completed plan forms a permanent bridge between two people. The app is a record of time spent together — not content consumed, not followers gained.

The design principle: **more friction on creation, zero friction on connection.** Plans require mutual acceptance. Completion requires physical presence. The network graph rewards consistency, not volume.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Fast, component-based, Cursor-friendly |
| Language | TypeScript | Type safety, catches errors before runtime |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Backend | Supabase | Auth, database, real-time, edge functions, cron — all free tier |
| Auth | Supabase Auth (Google + Apple OAuth) | No password management, mobile-native feel |
| Database | PostgreSQL via Supabase | Relational, handles graph data with join tables |
| Real-time | Supabase Realtime (WebSockets) | Live invite/confirmation flows |
| Notifications | Email via Supabase (SendGrid integration) + in-app list | MVP notification layer |
| AI categorization | Rule-based keyword matching (server-side edge function) | Free, fast, swappable later |
| Graph rendering | `react-force-graph` | Physics-based, interactive, WebGL-backed |
| OTP confirmation | Supabase Edge Function + ephemeral DB record | Server-validated, tamper-proof |
| Scheduled jobs | Supabase pg_cron | Nightly expiry checks |
| Mobile wrapping | Capacitor (v2+) | Unlocks BT, iOS/Android App Store |
| Deployment | Vercel (web) | Free tier, Git-connected auto-deploy |

---

## 3. Data Model

### `users`
```
id              uuid PK
display_name    text
username        text UNIQUE
avatar_url      text
bio             text (optional)
created_at      timestamptz
```

### `connections`
Represents a mutual friendship. Created once, shared by both users.
```
id              uuid PK
user_a_id       uuid FK → users
user_b_id       uuid FK → users
status          enum: pending | active
requested_by    uuid FK → users
created_at      timestamptz
accepted_at     timestamptz
```
Rule: `user_a_id < user_b_id` always (enforced by DB constraint) to prevent duplicate rows.

### `gum_pieces`
One row per plan. Shared between two users.
```
id              uuid PK
creator_id      uuid FK → users
recipient_id    uuid FK → users
title           text (max 60 chars)
category        text FK → categories.slug
color_hex       text (derived from category at creation)
status          enum: placeholder | active | confirmed | expired | turned_down
created_at      timestamptz
accepted_at     timestamptz
expires_at      timestamptz  -- created_at + 1yr for active; created_at + 48hr for placeholder
confirmed_at    timestamptz
```

### `categories`
Defined by you, not user-generated.
```
slug            text PK  (e.g. 'outdoors', 'food', 'intimate', 'creative', 'chill')
label           text
color_hex       text
keywords        text[]  -- used by the rule-based categorizer
```

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
Expired active pieces only (not rejected/turned-down).
```
id              uuid PK
gum_piece_id    uuid FK → gum_pieces
user_a_id       uuid FK → users
user_b_id       uuid FK → users
title           text
color_hex       text
created_at      timestamptz
expired_at      timestamptz
```

### `confirmation_sessions`
Ephemeral. Deleted after use or expiry.
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
Strava-style activity updates, auto-generated on bridge formation.
```
id              uuid PK
bridge_id       uuid FK → bridges
author_id       uuid FK → users
body            text (auto-generated, user can edit before publish)
is_public       boolean DEFAULT true  -- within network only
created_at      timestamptz
```

### `reactions`
```
id              uuid PK
post_id         uuid FK → posts
user_id         uuid FK → users
created_at      timestamptz
```
One row per user per post (unique constraint on post_id + user_id).

### `comments`
```
id              uuid PK
post_id         uuid FK → posts
user_id         uuid FK → users
body            text
created_at      timestamptz
```

### `notifications`
In-app list. Email sent separately via Supabase trigger.
```
id              uuid PK
user_id         uuid FK → users
type            enum: invite_received | invite_accepted | invite_rejected | 
                       plan_turned_down | plan_expiring_soon | bridge_formed | 
                       post_comment | post_reaction | connection_request
reference_id    uuid  -- points to relevant row (gum_piece, post, etc.)
read            boolean DEFAULT false
created_at      timestamptz
```

---

## 4. Slot Limits (enforced server-side)

- **Global per user:** 25 active slots (placeholders + active pieces combined)
- **Per pair:** 5 active slots
- Confirmed bridges and expired/rejected pieces do NOT occupy slots
- Slot check happens in the edge function before any piece is created or accepted
- If at limit: creation blocked, user shown current count and which pieces are active

---

## 5. Gum Piece Lifecycle

```
1. Creator submits title (max 60 chars)
2. Edge function: keyword match → category → color_hex assigned
3. Slot check: creator has global slot, pair has pair slot
4. gum_piece created (status: placeholder), expires_at = now + 48hr
5. Recipient gets invite notification
6. Recipient accepts:
   → status: active, expires_at = accepted_at + 1yr
7. Recipient rejects:
   → status: turned_down, slots freed, creator notified
8. 48hr passes with no response:
   → nightly cron sets status: expired, slots freed (no graveyard entry)
9. Either party turns it down while active:
   → status: turned_down, slots freed, other party notified
10. OTP confirmation:
    → initiator starts session, 6-digit code generated, expires in 5min
    → both users submit code in-app
    → edge function validates both confirmed within window
    → status: confirmed, bridge formed, slots freed
11. 1yr passes without confirmation:
    → nightly cron sets status: expired, graveyard entry created
```

---

## 6. OTP Confirmation Flow

1. User A taps "Mark as done" on a gum piece
2. Edge function creates `confirmation_session`: generates 6-digit code, sets 5min expiry
3. Both users see the same 6-digit code on their screens (real-time via Supabase Realtime)
4. Both tap "Confirm" — each sets their flag in `confirmation_sessions`
5. When both flags true AND within expiry: bridge forms, piece confirmed
6. If window expires with only one confirm: session deleted, piece stays active, try again
7. Code is never shown in URL or shareable — only visible inside the app to both parties

---

## 7. First Contact (Rotating QR)

1. User opens "Add someone" → server generates a token, stores with 60s TTL
2. QR code encodes a deep link: `stickybridges.app/connect?token=xyz`
3. Other user scans with in-app camera → app calls edge function with token
4. Edge function validates token (not expired, not already used) → marks used → creates pending connection
5. Recipient gets connection request notification → accepts or ignores
6. On accept: `connections` row status set to active, both users now in each other's network
7. Token is single-use. Screenshot of old QR is useless after 60s.

---

## 8. AI Categorization (Rule-based MVP)

Edge function runs on gum piece creation. Input: 60-char title string.

```typescript
const categories = [
  { slug: 'outdoors', color: '#7CB87C', keywords: ['hike','bike','cycle','walk','run','climb','kayak','swim','park','trail','outdoor','camp'] },
  { slug: 'food',     color: '#E8A87C', keywords: ['dinner','lunch','brunch','breakfast','café','coffee','cook','bake','restaurant','eat','drinks','bar'] },
  { slug: 'intimate', color: '#C9A0DC', keywords: ['sleepover','night in','movie','tv','chill','cozy','girls night','game night','board game'] },
  { slug: 'creative', color: '#E87C7C', keywords: ['paint','draw','music','concert','art','craft','make','build','studio','shoot','photo'] },
  { slug: 'explore',  color: '#7CB8E8', keywords: ['travel','trip','road','visit','museum','gallery','market','festival','show','tour'] },
  { slug: 'wellness', color: '#A8D8A8', keywords: ['yoga','gym','spa','meditate','pilates','stretch','workout','class'] },
]

// Lowercase the input, split into words, score each category by keyword hits
// Highest score wins. Tie → 'explore' as default. No match → 'explore'.
```

Swap this function body for an LLM API call later — the interface stays identical.

---

## 9. Network Graph

**Library:** `react-force-graph-2d`

**Behaviour:**
- Nodes: users in your network (including yourself at center)
- Edges: only shown when a node is selected — reveals all bridges shared with that person
- Physics: bridge weight (number of shared bridges) increases attractive force between nodes — more history = nodes sit closer together
- Interaction: drag nodes, graph rebalances. Click a node to see bridges. Click a bridge to see activity title, date, category color
- Default state: nodes float freely, no edges visible
- Selected state: edges to selected node appear, colored by category

**Export:** `html2canvas` captures the canvas element as PNG. Static snapshot.

---

## 10. Profile View

- **Gumball:** SVG circle composition, filled with colored segments proportional to category breakdown of all confirmed bridges. Tapping a segment shows category name + count.
- **Stat:** "Chewed gum with N people" — unique connection count only
- **No:** follower count, streak, total activity count, join date displayed prominently
- **Visible to network:** full profile + gumball + category breakdown
- **Not visible:** their network graph (only bridges shared with the viewer are shown)

---

## 11. Feed

- Visible only to mutual connections (network-only)
- Posts auto-generated when bridge forms — user gets a prompt to publish or skip (opt-out)
- Post contains: activity title, category, color chip, date, both participants tagged
- Reactions (one per user per post) and comments only
- No shares, no reposts, no DMs
- Chronological. No algorithm.

---

## 12. Graveyard

- Separate view, accessible from your own pocket/profile
- Shows gum pieces that expired after 1 year without confirmation
- Visually: desaturated versions of the original color
- Shows: activity title, who it was with, when it was created, when it expired
- No interaction — read only
- Does NOT include: rejected pieces, turned-down pieces, 48hr placeholder expiries

---

## 13. Screens List

```
Auth
  /              Landing / sign in
  /auth/callback OAuth callback

Onboarding
  /welcome       First-time user flow (display name, username, avatar)

Core
  /home          Pocket view — all active gum pieces (yours)
  /home/graveyard Expired plans
  /network       Force graph — your full network
  /feed          Activity feed (network only)
  /notifications In-app notification list

Profile
  /profile/:username  Anyone's profile (gumball + stat + shared bridges if connected)
  /profile/me         Your own profile

Connections
  /add           Rotating QR code display
  /connect        QR scan + connection request landing

Gum piece
  /piece/new      Create a new plan (recipient pre-filled from profile)
  /piece/:id      Detail view — active piece, actions (confirm, turn down)
  /piece/:id/confirm  OTP confirmation flow (both users)

Settings
  /settings       Account, notifications, auth
```

---

## 14. Notifications (Email + In-App)

| Event | In-app | Email |
|---|---|---|
| Connection request received | ✓ | ✓ |
| Connection accepted | ✓ | — |
| Gum invite received | ✓ | ✓ |
| Gum invite accepted | ✓ | — |
| Gum turned down | ✓ | ✓ |
| Plan expiring in 30 days | ✓ | ✓ |
| Bridge formed | ✓ | — |
| Comment on your post | ✓ | — |

Emails sent via Supabase + SendGrid (free tier: 100 emails/day).

---

## 15. Shipping Plan — Weekly Sprints

### Week 1 — Foundation
- Supabase project setup (auth, DB schema, RLS policies)
- Google + Apple OAuth
- Onboarding flow (display name, username, avatar upload)
- Rotating QR + first contact edge function
- Connection request + accept flow
- Basic profile page (your own)
- Deploy to Vercel

**End state:** Two people can sign up and add each other.

### Week 2 — The Pocket
- Gum piece creation form (60-char input)
- Rule-based categorizer edge function
- Invite flow (send, receive, accept, reject)
- Slot limit enforcement
- Pocket view (list of active + placeholder pieces)
- Piece detail view (status, actions)
- Piece turn-down flow (both directions)
- In-app notification list

**End state:** Two connected users can make and manage plans.

### Week 3 — Confirmation + Bridges
- OTP confirmation session edge function
- Real-time code sync (Supabase Realtime)
- Confirmation UI (both-sides flow)
- Bridge formation on success
- Graveyard view
- Nightly cron job (expiry checks)
- Email notifications (SendGrid setup)

**End state:** Plans can be completed end-to-end. The core loop works.

### Week 4 — The Network Graph
- `react-force-graph-2d` integration
- Node + edge rendering
- Physics tuning (bridge weight → attraction)
- Select-to-reveal edges
- Bridge detail tap (title, date, color)
- Graph PNG export

**End state:** The emotional centerpiece is playable.

### Week 5 — Profiles + Gumball
- Gumball SVG renderer (category proportions)
- Profile view (own + others)
- "Chewed gum with N people" stat
- Shared bridges visible on others' profiles
- Network visibility gating (RLS)

**End state:** Full profile experience works.

### Week 6 — Feed + Social
- Auto-post generation on bridge formation
- Opt-out prompt
- Feed view (network-gated)
- Reactions
- Comments
- Post detail view

**End state:** Social layer is live.

### Week 7 — Polish + Ship
- Edge case handling (slot full, BT unavailable, expired mid-flow)
- Loading states, empty states, error states
- Mobile responsiveness audit
- Performance pass
- Capacitor scaffold (ready for v2 BT upgrade)
- Final deploy + domain

**End state:** Shippable. Show it to people.

---

## 16. What's Deferred (v2+)

- Bluetooth confirmation (requires Capacitor build)
- Push notifications (requires Capacitor)
- LLM-based categorization (when API budget exists)
- Group plans (3+ people)
- Plan scheduling / calendar integration
- Animated gumball / network video export

---

## 17. Open Design Decisions

- Exact category list and color palette (to be defined by you before Week 2)
- Gumball visual style (flat segments vs. organic blob — needs design direction)
- Network graph node appearance (avatar circle vs. colored dot)
- Empty state copy and illustration direction

---

## 18. Security + Safety Notes

- All slot checks happen server-side (Supabase Edge Functions). Client cannot bypass.
- RLS (Row Level Security) on all tables — users can only read data they're authorized to see.
- OTP codes never exposed in URLs. In-app only.
- Rotating QR tokens are single-use + 60s TTL.
- No public user search — connections only via QR scan.
- Feed and network are gated to mutual connections only.
- Report/block flow deferred to v2 but schema should accommodate it (add `blocked_users` table in Week 1 schema even if UI ships later).

---

*Next document: `DEVDOC.md` — initialized at start of Week 1, updated each sprint.*
