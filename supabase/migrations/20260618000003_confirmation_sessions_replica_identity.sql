-- Without REPLICA IDENTITY FULL, Supabase Realtime UPDATE events for
-- confirmation_sessions only carry the primary key — confirmed_member_ids
-- changes from append_confirmed_member are invisible to other participants.
ALTER TABLE confirmation_sessions REPLICA IDENTITY FULL;
