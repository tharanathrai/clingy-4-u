-- Store the send-push bearer in Vault so the notifications trigger can call
-- the edge function without a plaintext token in any migration.
--
-- Run ONCE in the Supabase SQL editor after:
--   npx supabase secrets set SEND_PUSH_SECRET=<value> VAPID_KEYS_JSON=... VAPID_SUBJECT=...
--   npx supabase functions deploy send-push
--   npx supabase db push
-- Replace <value> below with the SAME string as SEND_PUSH_SECRET.
-- Until this runs, the trigger finds no secret and silently skips push.

do $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = 'send_push_secret';
  if existing_id is null then
    perform vault.create_secret('<value>', 'send_push_secret', 'Bearer token for the send-push edge function');
  else
    perform vault.update_secret(existing_id, '<value>');
  end if;
end $$;

-- Verify (after any notification insert):
--   select status_code, left(content, 200), created from net._http_response order by created desc limit 5;
-- Expect 202 {"queued":N} (or 200 {"sent":0} when the recipient has no subscriptions).
