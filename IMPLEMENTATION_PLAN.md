# Sticky Bridges — Implementation Completion Plan

**Created:** 2026-06-11 (spec `008-pending-flows-completion-plan`)  
**Source of truth for:** All work after specs `001`–`007`

---

## Ralph loop status

| State | Detail |
|-------|--------|
| Specs `001`–`007` | `## Status: COMPLETE` — Ralph may output `<promise>ALL_DONE</promise>` for this set only |
| Spec `008` | Meta-spec: audit + this plan |
| Spec `009` | COMPLETE — `plan_expiring_soon` cron in `run-expiry` |
| Spec `010` | COMPLETE — Playwright profile back E2E |
| Spec `011` | COMPLETE — regression matrix refresh (items 1–14 documented) |
| Specs `012+` | **Unlock further Ralph work** — pick lowest incomplete number first |

**Recommended Ralph order:** `012` → (P2 as promoted)

---

## Audit legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped + automated test evidence |
| 🟡 | Shipped; manual-only or stale verification |
| 🔶 | Partial — UI/schema exists, backend or polish missing |
| ⬜ | Deferred v2+ (PRD §17) |
| 🔧 | Fixed in spec 007; verify deploy + add E2E |

---

## P0 — Ship blockers

**None identified.** No DEVDOC flow is `Broken` or `Not built`. MVP core loop is coded.

Manual regression (spec `011`) may surface new P0 items — file as new specs if found.

---

## P1 — MVP completion

### 009 — `plan-expiring-soon-cron`

**Priority:** P1-1  
**Audit:** 🔶 Known issue #1, PRD §14

**Scope:** Extend `run-expiry` edge function to emit `plan_expiring_soon` in-app notifications (and optional email via `send-email`) when an active gum piece is within 30 days of `expires_at`. Idempotent: no duplicate warnings per piece per user. Notify both `creator_id` and `recipient_id`. UI copy and routing already exist.

**Acceptance (draft):**
- Cron run finds active pieces expiring in ≤30 days that have not yet received a warning
- Both parties get `plan_expiring_soon` notification rows
- Re-running cron does not duplicate notifications
- Email sent when Resend secrets configured (match invite/expiry pattern)
- Unit or integration test for idempotency window
- `DEVDOC.md` known issue #1 resolved; PRD §14 "Not yet implemented" removed

---

### 010 — `profile-back-e2e`

**Priority:** P1-2  
**Audit:** 🔧 Spec 007 implemented; no Playwright proof

**Scope:** Add Playwright smoke tests proving other-user profile back navigation: (1) feed author tap → profile → back returns to feed; (2) network `onViewProfile` with `returnTo` → back restores network context; (3) cold open `/profile/:username` → back falls back to `/home`. Uses mocked Supabase like existing `e2e/smoke.spec.ts`.

**Acceptance (draft):**
- Three Playwright tests pass in CI
- `BackHeader` visible on other-user profile in each path
- No regression to own profile `/profile/me` (no back header)
- `DEVDOC.md` Profile flow notes E2E back coverage

**Context:** Users reported missing back button when opening profiles from feed/network/notifications. Code fix landed in spec 007; this spec prevents silent regression and confirms deploy.

---

### 011 — `regression-matrix-refresh`

**Priority:** P1-3  
**Audit:** 🟡 Nine flows with stale manual evidence (last matrix entry May 2026)

**Scope:** Execute DEVDOC "Flows needing manual testing" items 1–14. Record pass/fail/blocker in `docs/regression-matrix.md` with dated session row. File new specs for any failures. Does not require automating all 14 — manual execution with documented evidence is sufficient.

**Manual test matrix (verification status as of 2026-06-11 audit):**

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 1 | Full core loop E2E (two users) | **pending** | Requires live Supabase + two accounts |
| 2 | Real-time OTP sync (two devices) | **pending** | Device pass |
| 3 | PWA install (Android + iOS) | **pending** | Device pass |
| 4 | Safe area insets (notch / Dynamic Island) | **pending** | Device pass |
| 5 | Email delivery (invite, turn-down, expiry) | **pending** | Requires Resend secrets |
| 6 | Avatar upload from Edit Profile | **pending** | Partial unit coverage; crop-over-sheet manual |
| 7 | Graph share / export PNG | **pending** | Unit tests for snapshot; device share manual |
| 8 | Nightly cron expiry (`run-expiry`) | **pending** | Manual invoke |
| 9 | Slot limits server-side | **pending** | API/RLS verification |
| 10 | QR token expiry (60s) | **pending** | Partial: `validateQrToken.test.ts` |
| 11 | Confirmation session race | **pending** | Two-client manual |
| 12 | Connection accepted real-time | **pending** | E2E covers accept from notifications only |
| 13 | Notification routing per type | **pending** | E2E partial |
| 14 | PostDetailSheet comment real-time | **pending** | Manual |

**Acceptance (draft):**
- Regression matrix row added with date and per-item status
- Any **fail** becomes a tracked spec or DEVDOC `Broken` entry
- Stale "Verified (manual)" labels in DEVDOC updated based on results

---

### 012 — `notification-routing-hardening`

**Priority:** P1-4  
**Audit:** 🔶 Known issue #2

**Scope:** When user taps `plan_expiring_soon` notification and the gum piece is already `expired`, auto-dismiss the notification or show inline "already expired" without leaving stale unread row. Piece detail UX ("This one didn't happen") remains correct.

**Acceptance (draft):**
- Tap on stale `plan_expiring_soon` marks notification read/dismissed
- No console errors; routing still works for valid expiring pieces
- Test coverage for tap handler branch

---

## P2 — Polish (post-MVP)

| Spec | Scope | Audit | Defer rationale if skipped |
|------|-------|-------|---------------------------|
| `013-graph-export-social-preset` | Larger node scale, framing, safe margins for social posting | ⬜ BACKLOG #1 | 2× export shipped; quality acceptable for MVP |
| `014-capacitor-version-align` | Align `@capacitor/cli` 7.x → 8.x with core | 🔶 Known issue #3 | Scaffold-only; `cap sync` warns but non-blocking |
| `015-avatar-storage-cleanup` | Delete Storage object when user removes avatar | 🔶 Regression matrix note | Orphan files low risk; URL null works |

---

## P3 — Deferred v2 (do not spec until promoted)

| Item | PRD §17 | Rationale |
|------|---------|-----------|
| Bluetooth confirmation | ✓ | Requires Capacitor native build |
| Push notifications | ✓ | Requires Capacitor + FCM/APNs |
| Per-shape SVG gum assets | ✓ | CSS blobs sufficient for MVP; shape stored server-side |
| LLM categorization | ✓ | Rule-based categorization shipped |
| Group plans (3+) | ✓ | Product scope v2 |
| Calendar / scheduling | ✓ | Product scope v2 |
| Animated gumball / video export | ✓ | Nice-to-have |
| Report / block flow | ✓ | No `blocked_users` table |
| Rate limiting (QR, OTP) | ✓ | Documented in rules; not enforced in DB yet |
| `useFeed` full `setQueryData` patches | — | Documented deviation in DEVDOC §13; debounced invalidate acceptable |
| Profile cache key by `viewerId` | — | Acceptable duplicate cache entries |

**Promotion rule:** Product owner explicitly moves an item from P3 → P1/P2 before Ralph picks it up.

---

## Flow audit summary (all DEVDOC flows)

| Flow | Audit | Evidence | Gap / next spec |
|------|-------|----------|-----------------|
| Auth | ✅ | E2E redirect smoke | — |
| Onboarding | ✅ | `useProfileReady` 5/5, E2E `/welcome` | — |
| QR Add / First Contact | 🟡 | Partial E2E (scan modes, connect modal) | `011` items 10; QR error cases unit-tested |
| Connection Requests | 🟡 | Matrix May 2026; E2E accept from notifications | `011` item 12 |
| Gum Piece Creation | ✅ | `categorizeTitle` 11/11 | — |
| Pocket View | 🟡 | No dedicated test | `011` items 1, 9 |
| Invite Accept / Decline | 🟡 | Stale manual | `011` item 1 |
| Confirmation Ceremony | 🟡 | Stale manual | `011` items 2, 11 |
| Bridge Formation | 🟡 | Server-only | Covered by ceremony + item 1 |
| Network Graph | 🟡 | `networkPairSummary` 5/5; export manual | `013` for export quality |
| Profile (own + others) | 🔧 | `profileUser.test.tsx`; no Playwright back | `010` |
| Feed | 🟡 | Stale manual | `011` items 14 |
| Notifications | 🟡 | `notifications.test.ts` 5/5; routing manual | `011` item 13; `012` for stale expiry |
| Settings | 🟡 | Stale manual | `011` item 6 |
| Graveyard | 🟡 | Stale manual | `011` item 8 |

---

## Known gaps (non-flow)

| Gap | Audit | Spec |
|-----|-------|------|
| `plan_expiring_soon` not generated | 🔶 | `009` |
| Stale `plan_expiring_soon` on expired piece | 🔶 | `012` |
| Capacitor version skew | 🔶 | `014` |
| Avatar Storage orphans on remove | 🔶 | `015` |
| Per-shape gum SVG | ⬜ | v2 |
| Graph export social preset | ⬜ | `013` |
| Report / block | ⬜ | v2 |
| Rate limiting | ⬜ | v2 |

---

## Profile back navigation (resolved + verify)

Implemented in spec `007` (`ProfileUser.tsx` + `BackHeader`). Entry points: feed, post detail, network sheet (`returnTo`), piece detail, AddScan, Connect, bridge sheet. Notifications do not deep-link to profiles directly.

**If users still report missing back:** check production deploy includes spec 007; confirm they are on `/profile/:username` not `/profile/me`; run spec `010` E2E in CI.

---

## Creating child specs

Use `/speckit.specify` or copy `templates/spec-template.md` into `specs/NNN-short-name/spec.md`. Mark `## Status: COMPLETE` only when Completion Signal passes and `npm run quality` succeeds.

After each child spec: update `DEVDOC.md`, append `history.md`, add `completion_log/` entry per constitution.
