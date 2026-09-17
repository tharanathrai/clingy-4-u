# Completion: 020-analytics-view-fixes

**Date:** 2026-09-17  
**Spec:** `specs/020-analytics-view-fixes/spec.md`

## Shipped

- FR-1: `analytics.confirmation_funnel` derives `sessions_completed` from `gum_pieces.confirmed_at`; adds `sessions_open`
- FR-2: `analytics.engagement_summary` counts `DISTINCT po.id` for `posts_total` / `posts_public`
- FR-3: `insight-pack.sql` section 3 selects `sessions_open`

## Tests

- No SQL harness (no local Postgres / Docker). View bodies dry-run against prod via `db query --linked`: funnel 5/4/1/0 + 2/0/2/0, engagement posts_total 8 (was 20).

## Quality

- `npm run quality` not affected (SQL + docs only)
