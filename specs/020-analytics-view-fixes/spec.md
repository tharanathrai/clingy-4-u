# Specification: Analytics View Fixes

## Status: COMPLETE

## Feature: Correct `analytics.confirmation_funnel` and `analytics.engagement_summary`

### Overview
The first run of the insight loop (`BACKLOG.md` § Analytics insights — 2026-09-17) found two of the six Layer-1 views report wrong numbers. Both are pure SQL defects; no client or edge-function change.

| View | Symptom | Cause |
|------|---------|-------|
| `analytics.confirmation_funnel` | `sessions_completed` always 0 while 4 pieces are `confirmed` | `submit-confirmation/index.ts` deletes the `confirmation_sessions` row on success (the client's `useConfirmationSession` listens for that `DELETE`). The table only ever holds failed or open attempts. |
| `analytics.engagement_summary` | `posts_total` 20 for 8 posts | `count(*)` over `posts LEFT JOIN reactions LEFT JOIN comments` fans out per reaction × comment. |

**In scope:** one migration redefining both views; `insight-pack.sql` surfaces the new `sessions_open` column; docs.

**Out of scope:** changing session lifecycle (soft-close instead of delete) — would touch `useConfirmationSession` realtime handling, `start-confirmation` dedupe and the confirm UI for no analytics gain; `feed_dwell` median (verified working — props carry `dwell_ms`; the null was an empty 14-day window).

---

## Functional Requirements

### FR-1: `confirmation_funnel` derives completions from pieces
- `sessions_completed` = `gum_pieces` with `status = 'confirmed'` and non-null `confirmed_at`, bucketed by `date_trunc('week', confirmed_at)`.
- `sessions_started` = surviving `confirmation_sessions` rows (bucketed by `created_at`) + completions.
- `sessions_expired_unconfirmed` unchanged in meaning (surviving, past `expires_at`, confirmed count below accepted-member count).
- New `sessions_open`: surviving, not yet expired. `completed + expired_unconfirmed + open = started` for every row.
- Keeps `WITH (security_invoker = true)`; stays inside the service_role-only `analytics` schema.

### FR-2: `engagement_summary` counts distinct posts
- `posts_total` and `posts_public` use `count(DISTINCT po.id)`. Reactions/comments were already distinct.

### FR-3: Insight pack
- Section 3 of `supabase/scripts/insight-pack.sql` selects `sessions_open`.

---

## Success Criteria
Against prod as of 2026-09-17:
- `confirmation_funnel` all-time: week 2026-06-15 → started 5, completed 4, expired 1, open 0; week 2026-06-22 → started 2, completed 0, expired 2, open 0.
- `engagement_summary` all-time: `posts_total` 8, `posts_public` 6, reactions 10, comments 7, bridges_with_posts 4.

## Dependencies
`supabase/migrations/20260619100000_analytics_views.sql` (schema + grants).

## Completion Signal

### Implementation Checklist
- [x] `supabase/migrations/20260917200000_analytics_view_fixes.sql`
- [x] `supabase/scripts/insight-pack.sql` section 3 updated
- [x] `BACKLOG.md` insights block corrected (items 3–4)
- [x] `history.md`, `completion_log/`, `docs/regression-matrix.md` rows

### Testing Requirements
No local Postgres or Docker on the dev machine, so no SQL unit test. Verification is a dry run of each view's `SELECT` body via `npx supabase db query --linked` against prod (done, matches Success Criteria) followed by `npx supabase db push` and re-running insight-pack sections 3 and 5.
