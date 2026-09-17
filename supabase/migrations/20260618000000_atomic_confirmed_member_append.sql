-- Atomic array append for confirmation sessions.
-- Replaces the read-modify-write pattern in submit-confirmation that caused
-- a race condition when two members simultaneously submitted confirmation.
CREATE OR REPLACE FUNCTION append_confirmed_member(
  p_session_id uuid,
  p_user_id text
) RETURNS text[] AS $$
DECLARE
  v_confirmed text[];
BEGIN
  UPDATE confirmation_sessions
  SET confirmed_member_ids =
    CASE
      WHEN p_user_id = ANY(confirmed_member_ids) THEN confirmed_member_ids
      ELSE array_append(confirmed_member_ids, p_user_id)
    END
  WHERE id = p_session_id
  RETURNING confirmed_member_ids INTO v_confirmed;

  RETURN COALESCE(v_confirmed, '{}'::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
