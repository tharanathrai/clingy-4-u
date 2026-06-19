# Analytics Loop — portable prompt

Paste this into any harness (Claude Code, Cursor, Kiro). It is intentionally
harness-agnostic: the whole workflow is files in this repo.

---

**Prompt:**

> Run `supabase/scripts/insight-pack.sql` against the project database as `service_role`
> (`supabase db execute --file supabase/scripts/insight-pack.sql`). Then follow
> `specs/analytics-insight-loop.md`: summarize the funnel/friction/retention signals with
> numbers, and append a dated `## Analytics insights — <today>` section to `BACKLOG.md`
> with 3-7 prioritized, metric-backed items. Don't invent data; skip empty sections.

---

## What's in the system

| Layer | Where | What it does |
|-------|-------|--------------|
| 1. Funnel views | `supabase/migrations/20260619100000_analytics_views.sql` | `analytics.*` views over existing domain tables. No client code. |
| 2. Behavior events | `analytics_events` table + `supabase/functions/track-events/` + `src/lib/analytics.ts` + `src/hooks/useTracker.ts` | Anonymous, content-free taps/screens/dwell, opt-out via Settings. |
| 3. Insight loop | `supabase/scripts/insight-pack.sql` + `specs/analytics-insight-loop.md` + this file | Turns data into prioritized backlog items. |

## Privacy guarantees (don't break these)

- `analytics_events.pseudonym` is `HMAC(user_id|install_id, ANALYTICS_SALT)` — never store raw ids.
- `props` is numbers/enums only; the edge function strips free text; a DB trigger rejects long strings.
- No IP is captured. Opt-out toggle in Settings ("Share anonymous usage data"); DNT respected.
- `analytics` schema + `analytics_events` are readable by `service_role` only.

## Setup once

- Set the function secret: `supabase secrets set ANALYTICS_SALT=<random-32+ char string>`.
- Deploy: `supabase functions deploy track-events` and push migrations (`supabase db push`).

## Extending to PostHog later

`src/lib/analytics.ts` defines an `AnalyticsSink` interface and ships `SupabaseSink`.
Implement `PostHogSink.capture/flush` and add it alongside `SupabaseSink` (fan-out) — no
call-site changes. Keep the same content-free `props` discipline.
