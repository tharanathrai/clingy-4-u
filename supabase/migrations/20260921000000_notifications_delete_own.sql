-- Users could never dismiss a notification: the notifications table had SELECT / UPDATE /
-- INSERT policies but no DELETE policy, so the client's optimistic delete was silently
-- filtered to zero rows by RLS and the row came back on the next fetch.
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((user_id = auth.uid()));
