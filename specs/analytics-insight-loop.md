# Spec: Analytics Insight Loop

## Status: ACTIVE

## Intent

Turn anonymized usage data into prioritized product decisions on a recurring cadence,
in a way that is **independent of any AI harness** (Claude Code today, Cursor or Kiro
tomorrow). The workflow lives in the repo, not in harness config — same pattern as
`RALPH_PROMPT.md` + `specs/`.

## Inputs

- `supabase/scripts/insight-pack.sql` — the runnable query pack (aggregate, no PII).
- Layer 1 views in the `analytics` schema and the `analytics_events` table.
- Requires `service_role` DB access (a local `DATABASE_URL` or `supabase db execute`).

## Procedure (any agent runs this)

1. Run the pack:
   `supabase db execute --file supabase/scripts/insight-pack.sql`
   (or `psql "$DATABASE_URL" -f supabase/scripts/insight-pack.sql`).
2. Read each section's output. Compare week-over-week where the query is time-bucketed.
3. Identify, with numbers:
   - The biggest drop-off step in the onboarding funnel.
   - Rising friction: confirm-ceremony `abandon_pct` trend, QR scan failure share, rage-tap hotspots.
   - Dead surfaces: screens with views but no downstream action.
   - Category trends and death rate.
4. Append a dated section to `BACKLOG.md` under `## Analytics insights` with:
   - 3-7 prioritized items, each tagged `[impact: high|med|low]` and a one-line rationale tied to a metric.
   - Each item phrased so it can become a spec via the existing `/speckit.specify` → Ralph build loop.
5. Do **not** invent data. If a section is empty (no events yet), say so and skip.

## Acceptance

- `BACKLOG.md` gains a `## Analytics insights — <YYYY-MM-DD>` block with metric-backed items.
- No PII appears anywhere in the output or the report (guaranteed upstream by the schema).

## Completion Signal

A dated insights block exists in `BACKLOG.md` and at least one item has been promoted
to a spec or explicitly deferred with a reason.

## Cadence

Run weekly. Trigger any of: `docs/ANALYTICS_LOOP.md` prompt pasted into any harness, a
scheduled cloud agent (`/schedule`), or a cron that runs the SQL and opens a PR.
