# Specification: Pending Flows Audit & Implementation Completion Plan

## Status: COMPLETE

## Feature: Post-MVP Flow Audit and Prioritized Completion Roadmap

### Overview
All numbered specs (`001`–`007`) are marked **COMPLETE**, yet several product surfaces remain unverified, partially implemented, or explicitly deferred. Users have reported navigation gaps (e.g. no back control when opening another user's profile from feed/network/notifications). Spec `007` addressed profile back navigation in code; remaining risk is stale deployment, missing E2E coverage, or flows that still lack verification evidence.

This meta-spec requires a **full audit** of every flow in `DEVDOC.md` against `PRD.md`, `BACKLOG.md`, and `docs/regression-matrix.md`, then production of a **prioritized implementation plan** (`IMPLEMENTATION_PLAN.md`) that breaks remaining work into numbered child specs Ralph can pick up after this spec completes.

**In scope:** Audit, gap classification, plan document, DEVDOC status refresh, child-spec outlines for priority items.

**Out of scope:** Implementing child specs (those become `009+`), v2 features unless explicitly promoted from deferred list.

### User Stories
- As a product owner, I want a single audit of what is shipped vs unverified vs not built so I know what remains before calling MVP done.
- As a developer running Ralph, I want `IMPLEMENTATION_PLAN.md` with prioritized child specs so the loop has work after spec `007`.
- As a user opening another person's profile from feed, network, or post detail, I want a back control — already specified in `007`; this audit confirms coverage and flags any entry points still missing `returnTo` or E2E proof.

---

## Flow Audit (Baseline — 2026-06-11)

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped + automated test evidence |
| 🟡 | Shipped; manual-only or stale verification |
| 🔶 | Partial — UI/schema exists, backend or polish missing |
| ⬜ | Deferred v2+ (PRD §17) |
| 🔧 | Fixed in spec 007; verify deploy + add E2E |

### Core flows (DEVDOC)

| Flow | DEVDOC status | Evidence | Audit result | Notes |
|------|---------------|----------|--------------|-------|
| Auth | Verified (automated) | E2E redirect smoke | ✅ | — |
| Onboarding | Verified (automated) | `useProfileReady` 5/5, E2E `/welcome` | ✅ | — |
| QR Add / First Contact | Working | Partial E2E (scan modes, connect modal) | 🟡 | No E2E for live token expiry, already_connected, request_pending |
| Connection Requests | Verified (manual) | Regression matrix May 2026 | 🟡 | E2E: accept from notifications only |
| Gum Piece Creation | Verified (automated) | `categorizeTitle` 11/11 | ✅ | — |
| Pocket View | Working | No dedicated test | 🟡 | Slot limits, FAB gating, realtime — manual only |
| Invite Accept / Decline | Verified (manual) | Stale | 🟡 | Placeholder vs active actions; creator cancel |
| Confirmation Ceremony | Verified (manual) | Stale | 🟡 | OTP sync across devices untested in CI |
| Bridge Formation | Verified (manual) | Server-only | 🟡 | No client test; depends on ceremony E2E |
| Network Graph | Verified (automated) | `networkPairSummary` 5/5 | 🟡 | Export quality BACKLOG TODO; device share manual |
| Profile (own + others) | Verified (automated) | `profileUser.test.tsx`, `avatarImage` | 🔧 | Back header in `ProfileUser.tsx`; no Playwright back-nav test |
| Feed | Verified (manual) | Stale | 🟡 | Reactions, comments, scroll restore — manual |
| Notifications | Verified (automated) | `notifications.test.ts` 5/5 | 🟡 | Routing matrix item 13 manual; mark-all icon in 006 |
| Settings | Verified (manual) | Stale | 🟡 | Notification toggles localStorage only |
| Graveyard | Verified (manual) | Stale | 🟡 | Pagination, empty state — manual |

### Known gaps (not full flows)

| Gap | Source | Audit result | Recommended spec |
|-----|--------|--------------|------------------|
| `plan_expiring_soon` never emitted | PRD §14, DEVDOC known issue #1 | 🔶 | `009-plan-expiring-soon-cron` |
| Stale `plan_expiring_soon` tap on expired piece | DEVDOC known issue #2 | 🔶 | Include in `009` or `010-notification-routing-hardening` |
| Per-shape gum SVG assets | PRD §17, DESIGN.md | ⬜ | v2 — `gum-shape-assets` |
| Graph export social preset | BACKLOG.md #1 | ⬜ | v2 — `graph-export-social-preset` |
| Report / block flow | PRD §17 | ⬜ | v2 |
| Rate limiting (QR, OTP) | PRD §17, rules | ⬜ | v2 — security hardening |
| Capacitor CLI/core version skew | DEVDOC known issue #3 | 🔶 | `011-capacitor-version-align` (low priority) |
| Avatar Storage orphan files on remove | Regression matrix note | 🔶 | `012-avatar-storage-cleanup` (low priority) |
| `useFeed` debounced invalidation vs rules | DEVDOC §13 deviation | 🟡 | Optional `feed-realtime-patches` — not blocking MVP |
| Profile cache key by viewerId | DEVDOC known issue #6 | 🟡 | Acceptable; document only |

### Profile back navigation (user question)

| Entry point | Navigation mechanism | Back expected? | Status |
|-------------|---------------------|----------------|--------|
| Feed author tap | `navigate(/profile/:username)` | History back → feed | 🔧 Spec 007 |
| Post detail author/commenter | `navigate(/profile/:username)` | History back → feed (+ sheet if history supports) | 🔧 Spec 007 |
| Network node sheet | `navigate` with `returnTo: /network` + `selectUserId` | Back → network with selection restore | 🔧 Spec 007 |
| Piece detail partner link | `<Link to=/profile/:username>` | History back → piece detail | 🔧 Spec 007 |
| AddScan / Connect "View profile" | `<Link>` | History back | 🔧 Spec 007 |
| Bridge detail sheet | `<Link>` | History back | 🔧 Spec 007 |
| Notifications (direct) | No profile deep links today | N/A | Users reach profile via feed/piece/network first |
| Tab bar Profile | `/profile/me` only | No back (tab root) | By design |
| Direct URL `/profile/:username` | No prior history | Fallback → `/home` | 🔧 Spec 007 |

**Conclusion:** Back navigation is implemented in code (`ProfileUser.tsx` + `BackHeader`). If users still see no back button, likely causes are: (1) production not deployed with spec `007`, (2) viewing own profile at `/profile/me`, or (3) a regression — add Playwright coverage in child spec `010`.

---

## Functional Requirements

### FR-1: Complete flow audit document
Produce an authoritative audit that reconciles DEVDOC, PRD implementation status, BACKLOG, and regression matrix.

**Acceptance Criteria:**
- [x] Every DEVDOC flow row appears in the audit with status symbol (✅/🟡/🔶/⬜/🔧) and evidence citation.
- [x] All DEVDOC "Known issues" and PRD §17 deferred items are classified (fix now vs v2).
- [x] All 14 DEVDOC "Flows needing manual testing" items are mapped to verification status (done / pending / blocked).
- [x] Audit summary table is copied into `DEVDOC.md` under a new **Post-MVP audit** subsection.

### FR-2: Implementation completion plan
Create `IMPLEMENTATION_PLAN.md` at repo root with prioritized work packages.

**Acceptance Criteria:**
- [x] Plan lists every 🟡 and 🔶 item with priority (P0 = ship blocker, P1 = MVP polish, P2 = v2).
- [x] Each P0/P1 item has a proposed child spec folder name (`009-short-name`, etc.) with 2–3 sentence scope.
- [x] Plan includes recommended Ralph loop order (lowest number first).
- [x] Plan explicitly states Ralph `ALL_DONE` today is accurate for specs `001`–`007` only; child specs unlock further work.
- [x] Profile back navigation verification is P1 with proposed spec `010-profile-back-e2e` (Playwright: feed → profile → back).

### FR-3: Child spec stubs for P0/P1
Draft minimal spec outlines so Ralph can implement without re-auditing.

**Acceptance Criteria:**
- [x] `009-plan-expiring-soon-cron` scope documented in plan: `run-expiry` emits 30-day warnings + optional email; idempotent; both users notified.
- [x] `010-profile-back-e2e` scope documented: Playwright paths for feed, network (with `returnTo`), and direct URL fallback.
- [x] `011-regression-matrix-refresh` scope documented: execute DEVDOC manual matrix items 1–14; update `docs/regression-matrix.md` with dated evidence.
- [x] At least one P2/v2 item documented with explicit "defer" rationale so scope does not creep.

### FR-4: DEVDOC and PRD sync
Keep product docs aligned with audit findings.

**Acceptance Criteria:**
- [x] `DEVDOC.md` flow statuses updated where audit contradicts current label (e.g. Profile → note E2E gap; QR Add → note verification gap).
- [x] `PRD.md` §16 Implementation Status gains a row: "Post-MVP audit" pointing to `IMPLEMENTATION_PLAN.md`.
- [x] No change to shipped feature behavior in this spec — documentation and planning only.

---

## Prioritized Implementation Plan (Target Output)

The implementer MUST materialize this structure in `IMPLEMENTATION_PLAN.md` (adjust only if audit discovers new gaps):

### P0 — Ship blockers (none identified)

No flow is marked `Broken` or `Not built`. MVP core loop is coded. P0 is empty unless manual regression finds a blocker.

### P1 — MVP completion (recommended Ralph order)

| Order | Spec | Scope | Why |
|-------|------|-------|-----|
| 1 | `009-plan-expiring-soon-cron` | `run-expiry` generates `plan_expiring_soon` notifications (+ email) 30 days before active piece expiry; no duplicates | Only feature with schema + UI but no backend |
| 2 | `010-profile-back-e2e` | Playwright: feed → profile → back; network with `returnTo`; cold `/profile/:user` → back → `/home` | Closes user-reported back gap with CI proof |
| 3 | `011-regression-matrix-refresh` | Run DEVDOC manual test items 1–14; document pass/fail; file bugs as new specs if failures | Stale manual evidence since May 2026 |
| 4 | `012-notification-routing-hardening` | Dismiss or reroute stale `plan_expiring_soon` when piece already expired | DEVDOC known issue #2 |

### P2 — Polish (post-MVP)

| Spec | Scope |
|------|-------|
| `013-graph-export-social-preset` | BACKLOG: larger nodes, framing, safe margins for social posting |
| `014-capacitor-version-align` | Align `@capacitor/cli` with core 8.x |
| `015-avatar-storage-cleanup` | Delete Storage object on remove photo (optional) |

### P3 — Deferred v2 (do not spec until promoted)

Bluetooth confirmation, push notifications, per-shape SVG assets, LLM categorization, group plans, calendar integration, animated export, report/block, rate limiting.

---

## Success Criteria

- Single source of truth (`IMPLEMENTATION_PLAN.md`) exists for all post-`007` work.
- Every DEVDOC flow has an audit classification with evidence.
- Product owner can answer "what's left for MVP?" in one page: P1 items above.
- Profile back navigation gap is explained and has a verification path (spec `010`).
- Ralph loop can resume with spec `009` after this spec completes.

---

## Dependencies
- `DEVDOC.md`, `PRD.md`, `BACKLOG.md`, `docs/regression-matrix.md`, `history.md`
- Completed specs `001`–`007` (especially `007-profile-back-navigation`, `006-notifications-icon-cursor`)
- `templates/spec-template.md` for child spec authoring

## Assumptions
- MVP is functionally complete in code; remaining work is verification, one backend gap (`plan_expiring_soon`), and polish.
- Child specs `009+` are created either as full `spec.md` files in this spec's implementation or as the first step of each Ralph iteration.
- v2 items stay out of scope unless explicitly promoted by product owner.

---

## Completion Signal

### Implementation Checklist
- [x] Flow audit table completed and matches all DEVDOC flows
- [x] `IMPLEMENTATION_PLAN.md` created at repo root with P0/P1/P2/P3 sections
- [x] Child spec scopes written for `009`–`012` (minimum)
- [x] `DEVDOC.md` updated with Post-MVP audit subsection and corrected flow statuses
- [x] `PRD.md` §16 updated with pointer to implementation plan
- [x] Profile back navigation finding documented (resolved in 007; verify via 010)

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] No application code changes required (docs-only spec)
- [x] If incidental code touched, `npm run quality` still passes
- [x] No lint errors in edited markdown

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Audit covers 100% of DEVDOC flow rows
- [x] IMPLEMENTATION_PLAN priorities are justified

#### Documentation Verification
- [x] `IMPLEMENTATION_PLAN.md` is actionable by Ralph without re-reading entire repo
- [x] No contradictory status between DEVDOC, PRD, and plan

### Iteration Instructions

If ANY check fails:
1. Identify the specific gap in audit or plan
2. Re-read DEVDOC/PRD/BACKLOG
3. Update documents
4. Verify all criteria
5. Commit and push (Ralph loop only)

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
