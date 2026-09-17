-- Enable full replica identity on connections so realtime UPDATE payloads
-- include the old row. This lets the network graph skip invalidation when
-- only snooze flags change (status unchanged).
ALTER TABLE connections REPLICA IDENTITY FULL;
