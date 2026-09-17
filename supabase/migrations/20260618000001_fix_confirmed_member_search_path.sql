-- Re-create append_confirmed_member with explicit search_path so PostgREST
-- can resolve confirmation_sessions regardless of the calling role's default path.
CREATE OR REPLACE FUNCTION public.append_confirmed_member(
  p_session_id uuid,
  p_user_id text
) RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.append_confirmed_member(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_confirmed_member(uuid, text) TO authenticated;
