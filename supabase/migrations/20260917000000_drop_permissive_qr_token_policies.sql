-- Drop over-permissive RLS policies on rotating_qr_tokens.
--
-- These policies granted every authenticated user SELECT/DELETE on all rows
-- (USING (true)), which let any signed-in user read other users' live QR
-- tokens and connect without scanning. The client never queries this table;
-- generate-qr-token / validate-qr-token use the service-role client, which
-- bypasses RLS. Owner-scoped policies (user_id = auth.uid()) are kept.

DROP POLICY IF EXISTS "qr_select_any_auth" ON public.rotating_qr_tokens;
DROP POLICY IF EXISTS "qr_delete_any_auth" ON public.rotating_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_delete_any_authenticated" ON public.rotating_qr_tokens;
