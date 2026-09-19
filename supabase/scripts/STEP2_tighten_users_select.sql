-- STEP 2 OF 2 -- NOT YET A MIGRATION, ON PURPOSE.
--
-- `supabase db push` applies every pending migration at once. If this file sat
-- in supabase/migrations/ it would flip the policy in the same push that adds
-- the RPCs -- before the client calling them is deployed -- and onboarding would
-- break in the gap (Welcome.tsx reads an RLS-hidden row as "username available"
-- and dies at the insert on users_username_key).
--
-- Promote it only after 20260918120000 is applied AND the client is live:
--   git mv supabase/scripts/STEP2_tighten_users_select.sql \
--          supabase/migrations/20260918120001_tighten_users_select.sql
--   npx supabase db push
--
-- Item 1, part B: the swap. This is the only moment visibility actually changes.
--
-- DO NOT APPLY THIS until the RPCs from 20260918120000 AND the client that calls
-- them are live in production. In the gap, Welcome.tsx reads an RLS-hidden row
-- as "username available" and onboarding dies at the insert with a unique
-- violation on users_username_key.
--
-- "users_select_own_or_username_lookup" is FOR SELECT TO authenticated
-- USING (true) -- the name describes an intent the policy never implemented.
-- With it in place any signed-in account can GET /rest/v1/users?select=* and
-- take every profile: id, display_name, username, avatar_url, bio, created_at.
-- That contradicts the QR-only, no-search-by-name promise in src/pages/Terms.tsx.
--
-- (The TO public twin, "Users can read any profile", was dropped in
-- 20260918100000 -- that one made the same data readable with the publishable
-- key alone, no sign-in at all.)
--
-- Rollback, if a read path turns out to be uncovered:
--   drop policy if exists users_select_visible on public.users;
--   create policy "users_select_own_or_username_lookup" on public.users
--     for select to authenticated using (true);
-- The RPCs and indexes are additive and can stay.

drop policy if exists "users_select_own_or_username_lookup" on public.users;

create policy users_select_visible on public.users
  for select to authenticated
  using (public.can_view_user(id));
