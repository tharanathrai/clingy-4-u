-- Fix gum_pieces SELECT RLS to cover group-plan invitees.
--
-- Original policy checked creator_id or recipient_id. Group plans have
-- recipient_id = NULL, so invitees couldn't SELECT their own plans.
-- New policy: any user with a row in gum_piece_members can SELECT the piece.
-- The members table is always populated (creator + all invitees) at creation.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'gum_pieces'
      AND cmd        = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.gum_pieces', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "gum_pieces_select_for_members"
ON public.gum_pieces
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.gum_piece_members
    WHERE gum_piece_id = gum_pieces.id
      AND user_id = auth.uid()
  )
);
