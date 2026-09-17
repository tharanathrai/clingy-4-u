-- Analytics layer 2: behavior event store.
-- Pseudonymized (HMAC, no FK to users), content-free, inserted only via the
-- track-events edge function (service role). RLS enabled with NO anon/authenticated
-- policies, so clients can neither read nor write directly. Readable by service_role only.

CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym   text NOT NULL,                 -- HMAC(user_id|install_id, ANALYTICS_SALT); not reversible
  session_id  text NOT NULL,                 -- per app-open, client-generated
  event_name  text NOT NULL,                 -- allowlisted enum (validated in edge fn)
  surface     text,                          -- route/screen, e.g. 'piece_confirm'
  props       jsonb NOT NULL DEFAULT '{}'::jsonb, -- numbers/enums only
  platform    text,                          -- 'web' | 'ios' | 'android'
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx
  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_surface_time_idx
  ON analytics_events (surface, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_pseudonym_idx
  ON analytics_events (pseudonym);

-- Defense-in-depth: reject rows whose props carry long free-text strings
-- (the edge function already sanitizes; this guards direct service-role mistakes).
CREATE OR REPLACE FUNCTION analytics_events_reject_freetext()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  FOR v IN SELECT value FROM jsonb_each(NEW.props)
  LOOP
    IF jsonb_typeof(v) = 'string' AND length(v #>> '{}') > 64 THEN
      RAISE EXCEPTION 'analytics props string too long (possible content leak)';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS analytics_events_freetext_guard ON analytics_events;
CREATE TRIGGER analytics_events_freetext_guard
  BEFORE INSERT OR UPDATE ON analytics_events
  FOR EACH ROW EXECUTE FUNCTION analytics_events_reject_freetext();

-- RLS on, no policies => only service_role (which bypasses RLS) can touch the table.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics_events FROM anon, authenticated;
