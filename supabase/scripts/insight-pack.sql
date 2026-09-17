-- Insight pack: harness-agnostic analytics queries for the product loop.
-- Run as service_role (it reads the locked-down `analytics` schema + analytics_events).
--   supabase db execute --file supabase/scripts/insight-pack.sql
--   or: psql "$DATABASE_URL" -f supabase/scripts/insight-pack.sql
-- Any agent (Claude Code / Cursor / Kiro) runs this, reads the output, and proposes backlog items.
-- Output is aggregate-only; no PII is selectable here by construction.

\echo '== 1. Onboarding funnel (last 8 weeks) =='
SELECT * FROM analytics.onboarding_funnel
WHERE cohort_week >= now() - interval '8 weeks'
ORDER BY cohort_week;

\echo '== 2. Piece lifecycle status mix (last 4 weeks) =='
SELECT status, sum(pieces) AS pieces,
       round(avg(median_seconds_to_confirm)) AS avg_median_seconds_to_confirm
FROM analytics.piece_lifecycle
WHERE created_week >= now() - interval '4 weeks'
GROUP BY status
ORDER BY pieces DESC;

\echo '== 3. Confirmation (OTP ceremony) friction — abandonment rate =='
SELECT created_week,
       sessions_started,
       sessions_completed,
       sessions_expired_unconfirmed,
       sessions_open,
       round(100.0 * sessions_expired_unconfirmed
             / nullif(sessions_started, 0), 1) AS abandon_pct
FROM analytics.confirmation_funnel
WHERE created_week >= now() - interval '8 weeks'
ORDER BY created_week;

\echo '== 4. Category popularity + death rate =='
SELECT category, pieces_created, pieces_confirmed, bridges_formed, graveyard_count,
       round(100.0 * graveyard_count / nullif(pieces_created, 0), 1) AS death_pct
FROM analytics.category_popularity
ORDER BY pieces_created DESC;

\echo '== 5. Engagement (posts / reactions / comments) =='
SELECT * FROM analytics.engagement_summary
WHERE created_week >= now() - interval '8 weeks'
ORDER BY created_week;

\echo '== 6. Retention cohorts (week offsets) =='
SELECT * FROM analytics.retention_cohorts
WHERE cohort_week >= now() - interval '8 weeks'
ORDER BY cohort_week, week_offset;

-- ===== Behavior signals from analytics_events (under-the-layer) =====

\echo '== 7. Top screens by views (last 7 days) =='
SELECT surface, count(*) AS views
FROM analytics_events
WHERE event_name = 'screen_view' AND created_at >= now() - interval '7 days'
GROUP BY surface
ORDER BY views DESC
LIMIT 20;

\echo '== 8. Confirm-ceremony behavior funnel (last 14 days) =='
SELECT event_name, count(*) AS n
FROM analytics_events
WHERE event_name IN ('confirm_enter','confirm_abandon','confirm_success')
  AND created_at >= now() - interval '14 days'
GROUP BY event_name
ORDER BY n DESC;

\echo '== 9. QR scan reliability (last 14 days) =='
SELECT event_name, count(*) AS n
FROM analytics_events
WHERE event_name LIKE 'qr_scan_%' AND created_at >= now() - interval '14 days'
GROUP BY event_name
ORDER BY n DESC;

\echo '== 10. Rage taps by surface (last 14 days) — friction hotspots =='
SELECT surface, count(*) AS rage_taps
FROM analytics_events
WHERE event_name = 'rage_tap' AND created_at >= now() - interval '14 days'
GROUP BY surface
ORDER BY rage_taps DESC
LIMIT 20;

\echo '== 11. Dead surfaces — viewed but no downstream action (last 14 days) =='
SELECT surface, count(*) AS views
FROM analytics_events
WHERE event_name = 'screen_view' AND created_at >= now() - interval '14 days'
GROUP BY surface
HAVING count(*) > 0
ORDER BY views DESC;

\echo '== 12. Median feed dwell ms (last 14 days) =='
SELECT percentile_cont(0.5) WITHIN GROUP (
         ORDER BY (props->>'dwell_ms')::numeric
       ) AS median_feed_dwell_ms
FROM analytics_events
WHERE event_name = 'feed_dwell'
  AND created_at >= now() - interval '14 days'
  AND props ? 'dwell_ms';
