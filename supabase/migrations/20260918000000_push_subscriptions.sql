-- Web Push subscriptions (spec 022).
--
-- One row per browser push endpoint. A user can have several (phone + laptop);
-- the same device re-subscribing after a service-worker update usually reuses
-- its endpoint, hence the UNIQUE + client upsert on `endpoint`.
--
-- Only the owner reads/writes their rows; `send-push` reads with the service
-- role and deletes rows the push service reports as gone (404/410).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

-- UPDATE is needed for the client `upsert(..., { onConflict: 'endpoint' })`.
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());
