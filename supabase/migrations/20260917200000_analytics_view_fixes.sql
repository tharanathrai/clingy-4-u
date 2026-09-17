-- Analytics view fixes (spec 020).
--
-- 1. analytics.confirmation_funnel: sessions_completed was always 0 because
--    submit-confirmation deletes the confirmation_sessions row on success, so
--    the table only ever holds failed/open attempts. Completions are now
--    derived from gum_pieces.confirmed_at (each successful ceremony deletes
--    exactly one session and stamps exactly one piece). sessions_started is
--    surviving sessions + completions. Surviving sessions bucket by
--    created_at, completions by confirmed_at; both lie within the ~24h session
--    window so weekly buckets agree in practice. Adds sessions_open so the
--    three outcome columns sum to sessions_started.
--
-- 2. analytics.engagement_summary: posts_total / posts_public used count(*)
--    over posts LEFT JOIN reactions LEFT JOIN comments, which multiplies each
--    post by its reactions x comments (reported 20 for 8 posts). Count
--    DISTINCT post ids.
--
-- Both views keep security_invoker and remain service_role-only via the
-- analytics schema grants set in 20260619100000_analytics_views.sql.

DROP VIEW IF EXISTS analytics.confirmation_funnel;
CREATE VIEW analytics.confirmation_funnel
WITH (security_invoker = true) AS
WITH surviving AS (
  SELECT
    date_trunc('week', cs.created_at)                          AS wk,
    cs.expires_at,
    coalesce(array_length(cs.confirmed_member_ids, 1), 0)      AS confirmed_n,
    (SELECT count(*)::int
       FROM gum_piece_members m
      WHERE m.gum_piece_id = cs.gum_piece_id
        AND m.status = 'accepted')                             AS member_count
  FROM confirmation_sessions cs
),
completed AS (
  SELECT date_trunc('week', confirmed_at) AS wk
  FROM gum_pieces
  WHERE status = 'confirmed' AND confirmed_at IS NOT NULL
),
weeks AS (
  SELECT wk FROM surviving
  UNION
  SELECT wk FROM completed
)
SELECT
  w.wk                                                         AS created_week,
  (SELECT count(*) FROM surviving s WHERE s.wk = w.wk)
    + (SELECT count(*) FROM completed c WHERE c.wk = w.wk)     AS sessions_started,
  (SELECT count(*) FROM completed c WHERE c.wk = w.wk)         AS sessions_completed,
  (SELECT count(*) FROM surviving s
    WHERE s.wk = w.wk
      AND s.expires_at < now()
      AND s.confirmed_n < s.member_count)                      AS sessions_expired_unconfirmed,
  (SELECT count(*) FROM surviving s
    WHERE s.wk = w.wk
      AND s.expires_at >= now())                               AS sessions_open
FROM weeks w
ORDER BY w.wk;

CREATE OR REPLACE VIEW analytics.engagement_summary
WITH (security_invoker = true) AS
SELECT
  date_trunc('week', po.created_at)                            AS created_week,
  count(DISTINCT po.bridge_id)                                 AS bridges_with_posts,
  count(DISTINCT po.id)                                        AS posts_total,
  count(DISTINCT po.id) FILTER (WHERE po.is_public)            AS posts_public,
  count(DISTINCT r.id)                                         AS reactions_total,
  count(DISTINCT cm.id)                                        AS comments_total
FROM posts po
LEFT JOIN reactions r  ON r.post_id = po.id
LEFT JOIN comments cm  ON cm.post_id = po.id
GROUP BY date_trunc('week', po.created_at)
ORDER BY created_week;
