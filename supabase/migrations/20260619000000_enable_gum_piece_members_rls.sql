-- SECURITY FIX: gum_piece_members was created with RLS disabled, so any
-- client (anon key) could read/write every membership row across all users.
--
-- Fix:
--   1. Enable RLS.
--   2. SELECT policy: a user may read all member rows of any gum_piece they
--      themselves belong to (group plans need co-member visibility).
--   3. No INSERT/UPDATE/DELETE policies are defined. All writes go through
--      edge functions using the service_role key, which bypasses RLS.
--      The client only ever SELECTs this table.
--
-- Recursion note: a membership-check policy that subqueries gum_piece_members
-- from within its own USING clause would recurse infinitely. We use a
-- SECURITY DEFINER helper that runs as owner (bypassing RLS) to break the loop.

CREATE OR REPLACE FUNCTION public.is_gum_piece_member(p_piece_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gum_piece_members
    WHERE gum_piece_id = p_piece_id
      AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_gum_piece_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_gum_piece_member(uuid, uuid) TO authenticated;

ALTER TABLE public.gum_piece_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gum_piece_members_select_for_members" ON public.gum_piece_members;
CREATE POLICY "gum_piece_members_select_for_members"
ON public.gum_piece_members
FOR SELECT
TO authenticated
USING (
  public.is_gum_piece_member(gum_piece_id, auth.uid())
);
