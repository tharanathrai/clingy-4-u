-- Fix append_confirmed_member: p_user_id must be uuid, not text.
-- array_append(uuid[], text) fails at runtime because text→uuid is an
-- assignment-level cast, not implicit — PostgreSQL's polymorphic type
-- resolution for anyarray/anyelement requires an implicit cast.
CREATE OR REPLACE FUNCTION public.append_confirmed_member(
  p_session_id uuid,
  p_user_id uuid
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

GRANT EXECUTE ON FUNCTION public.append_confirmed_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_confirmed_member(uuid, uuid) TO authenticated;

-- Drop the broken text-param overload so stale callers fail loudly instead of silently.
DROP FUNCTION IF EXISTS public.append_confirmed_member(uuid, text);
