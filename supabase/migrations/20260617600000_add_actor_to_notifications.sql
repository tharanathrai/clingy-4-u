-- Add actor identity columns to notifications so cloud functions can
-- denormalize the actor's display name and avatar at write time.
-- This prevents "Unknown user" when the referenced plan is no longer
-- readable (expired, turned_down, confirmed) at notification render time.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_avatar_url text;
