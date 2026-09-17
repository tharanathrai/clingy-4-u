-- Analytics layer 1: domain funnel views over existing tables.
-- Aggregate-only, no PII (no display_name / title / body / email selected).
-- Lives in a dedicated `analytics` schema, granted to service_role only.

CREATE SCHEMA IF NOT EXISTS analytics;

-- Lock the schema down: only service_role may use it. anon/authenticated get nothing.
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
GRANT USAGE ON SCHEMA analytics TO service_role;

-- 1. Onboarding funnel -----------------------------------------------------
-- Step conversion from signup -> first connection -> first piece -> first confirmed piece.
CREATE OR REPLACE VIEW analytics.onboarding_funnel
WITH (security_invoker = true) AS
WITH signed_up AS (
  SELECT id, date_trunc('week', created_at) AS cohort_week FROM users
),
with_connection AS (
  SELECT DISTINCT u.id
  FROM users u
  JOIN connections c ON c.user_a_id = u.id OR c.user_b_id = u.id
),
with_piece AS (
  SELECT DISTINCT creator_id AS id FROM gum_pieces
),
with_confirmed AS (
  SELECT DISTINCT creator_id AS id FROM gum_pieces WHERE status = 'confirmed'
)
SELECT
  s.cohort_week,
  count(*)                                                   AS signed_up,
  count(*) FILTER (WHERE wc.id IS NOT NULL)                  AS reached_connection,
  count(*) FILTER (WHERE wp.id IS NOT NULL)                  AS reached_first_piece,
  count(*) FILTER (WHERE wcf.id IS NOT NULL)                 AS reached_first_confirmed
FROM signed_up s
LEFT JOIN with_connection wc  ON wc.id = s.id
LEFT JOIN with_piece wp       ON wp.id = s.id
LEFT JOIN with_confirmed wcf  ON wcf.id = s.id
GROUP BY s.cohort_week
ORDER BY s.cohort_week;

-- 2. Gum-piece lifecycle ---------------------------------------------------
-- Status distribution + median time-to-confirm. The core activation/retention signal.
CREATE OR REPLACE VIEW analytics.piece_lifecycle
WITH (security_invoker = true) AS
SELECT
  status,
  date_trunc('week', created_at)                                       AS created_week,
  count(*)                                                             AS pieces,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (confirmed_at - created_at))
  ) FILTER (WHERE confirmed_at IS NOT NULL)                           AS median_seconds_to_confirm
FROM gum_pieces
GROUP BY status, date_trunc('week', created_at)
ORDER BY created_week, status;

-- 3. Confirmation (OTP ceremony) funnel -----------------------------------
-- Sessions started vs fully confirmed vs expired-unconfirmed = ceremony friction.
CREATE OR REPLACE VIEW analytics.confirmation_funnel
WITH (security_invoker = true) AS
SELECT
  date_trunc('week', cs.created_at)                                    AS created_week,
  count(*)                                                            AS sessions_started,
  count(*) FILTER (
    WHERE coalesce(array_length(cs.confirmed_member_ids, 1), 0) >= mc.member_count
  )                                                                   AS sessions_completed,
  count(*) FILTER (
    WHERE cs.expires_at < now()
      AND coalesce(array_length(cs.confirmed_member_ids, 1), 0) < mc.member_count
  )                                                                   AS sessions_expired_unconfirmed
FROM confirmation_sessions cs
LEFT JOIN LATERAL (
  SELECT count(*)::int AS member_count
  FROM gum_piece_members m
  WHERE m.gum_piece_id = cs.gum_piece_id AND m.status = 'accepted'
) mc ON true
GROUP BY date_trunc('week', cs.created_at)
ORDER BY created_week;

-- 4. Category popularity + death rate -------------------------------------
CREATE OR REPLACE VIEW analytics.category_popularity
WITH (security_invoker = true) AS
SELECT
  p.category,
  count(*)                                              AS pieces_created,
  count(*) FILTER (WHERE p.status = 'confirmed')        AS pieces_confirmed,
  count(*) FILTER (WHERE p.status = 'expired')          AS pieces_expired,
  count(b.id)                                           AS bridges_formed,
  count(g.id)                                           AS graveyard_count
FROM gum_pieces p
LEFT JOIN bridges b   ON b.gum_piece_id = p.id
LEFT JOIN graveyard g ON g.gum_piece_id = p.id
GROUP BY p.category
ORDER BY pieces_created DESC;

-- 5. Engagement summary ----------------------------------------------------
CREATE OR REPLACE VIEW analytics.engagement_summary
WITH (security_invoker = true) AS
SELECT
  date_trunc('week', po.created_at)                     AS created_week,
  count(DISTINCT po.bridge_id)                          AS bridges_with_posts,
  count(*)                                              AS posts_total,
  count(*) FILTER (WHERE po.is_public)                  AS posts_public,
  count(DISTINCT r.id)                                  AS reactions_total,
  count(DISTINCT cm.id)                                 AS comments_total
FROM posts po
LEFT JOIN reactions r  ON r.post_id = po.id
LEFT JOIN comments cm  ON cm.post_id = po.id
GROUP BY date_trunc('week', po.created_at)
ORDER BY created_week;

-- 6. Weekly retention cohorts ---------------------------------------------
-- Cohort by signup week; "active" = created a piece in week N after signup.
CREATE OR REPLACE VIEW analytics.retention_cohorts
WITH (security_invoker = true) AS
WITH cohort AS (
  SELECT id, date_trunc('week', created_at) AS cohort_week FROM users
),
activity AS (
  SELECT creator_id AS id, date_trunc('week', created_at) AS active_week
  FROM gum_pieces
)
SELECT
  c.cohort_week,
  floor(EXTRACT(EPOCH FROM (a.active_week - c.cohort_week)) / 604800)::int AS week_offset,
  count(DISTINCT c.id)                                                     AS active_users
FROM cohort c
JOIN activity a ON a.id = c.id AND a.active_week >= c.cohort_week
GROUP BY c.cohort_week, week_offset
ORDER BY c.cohort_week, week_offset;

-- Grant read on all views to service_role only.
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO service_role;
