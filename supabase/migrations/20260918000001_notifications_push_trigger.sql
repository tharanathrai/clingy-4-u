-- Fan every new notification out to Web Push (spec 022).
--
-- AFTER INSERT on public.notifications -> pg_net POST to the `send-push` edge
-- function, which looks up the recipient's push_subscriptions and sends.
--
-- The bearer is read from Vault (`send_push_secret`, stored once by
-- supabase/scripts/setup-send-push.sql) so no token lives in the migration.
-- SECURITY DEFINER is required: the insert runs as service_role or
-- authenticated, neither of which may read vault.decrypted_secrets; migrations
-- run as postgres. pg_net is async so the insert never waits on the HTTP call.
-- Failures are silent by design — inspect `net._http_response`.

-- Every notification insert already goes through an edge function with the
-- service role (bypasses RLS). This WITH CHECK (true) policy let any signed-in
-- user insert arbitrary rows for anyone; with push wired to INSERT that would
-- be a spam vector. Client code only selects/updates/deletes.
drop policy if exists "notifications_insert_own_or_related" on public.notifications;

create or replace function public.notify_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  -- Hidden from the in-app list; a push would tap through to nothing.
  if new.type = 'post_reaction' then
    return new;
  end if;

  select decrypted_secret into secret
    from vault.decrypted_secrets
   where name = 'send_push_secret';

  -- Not configured yet (fresh environment) — never block the insert.
  if secret is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://hceigqxjpqwrmnajfoii.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret
      ),
      body := jsonb_build_object('notification', to_jsonb(new)),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'send-push enqueue failed: %', sqlerrm;
  end;

  return new;
end
$$;

revoke all on function public.notify_push_on_notification_insert() from public;

drop trigger if exists notifications_push_after_insert on public.notifications;
create trigger notifications_push_after_insert
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification_insert();
