-- Schedule the nightly run-expiry cron with a Vault-backed secret.
--
-- Run ONCE in the Supabase SQL editor after:
--   npx supabase secrets set RUN_EXPIRY_SECRET=<value>
--   npx supabase functions deploy run-expiry
-- Replace <value> below with the SAME string. The secret never lives in
-- cron.job.command in plaintext; the job reads it from Vault at run time.
--
-- Why: the previous job carried a hard-coded bearer that stopped matching
-- SUPABASE_SERVICE_ROLE_KEY, so run-expiry returned 401 every night and no
-- plan ever expired (found 2026-09-17).

-- 1. Store / rotate the secret in Vault.
do $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = 'run_expiry_secret';
  if existing_id is null then
    perform vault.create_secret('<value>', 'run_expiry_secret', 'Bearer token for the run-expiry edge function');
  else
    perform vault.update_secret(existing_id, '<value>');
  end if;
end $$;

-- 2. Replace the job.
select cron.unschedule('nightly-expiry')
where exists (select 1 from cron.job where jobname = 'nightly-expiry');

select cron.schedule(
  'nightly-expiry',
  '0 2 * * *',
  $job$
  select net.http_post(
    url := 'https://hceigqxjpqwrmnajfoii.supabase.co/functions/v1/run-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'run_expiry_secret'
      )
    ),
    body := '{}'::jsonb
  )
  $job$
);

-- 3. Verify (run the morning after, or after a manual invoke):
--   select status_code, left(content, 200), created from net._http_response order by created desc limit 3;
-- Expect 200 with {"expired_placeholders":..,"expiring_soon_notified":..,"expired_active":..,"cleaned_sessions":..}.
