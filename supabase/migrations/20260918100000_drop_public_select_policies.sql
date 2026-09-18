-- SECURITY: three SELECT policies were FOR SELECT TO public USING (true), and
-- `anon` holds the SELECT grant on all three tables. `public` includes `anon`,
-- so the full user directory and every comment body and reaction in the
-- database were readable with the publishable key alone -- no sign-in, no
-- session. Verified against prod 2026-09-18 with an unauthenticated curl:
-- /rest/v1/users returned every profile (display_name, username, bio,
-- avatar_url, id) and /rest/v1/comments returned every comment body.
--
-- Each of the two content policies already has a correctly-scoped twin that
-- restricts rows to posts the caller may see, so dropping the permissive one
-- has no client impact:
--   comments  -> "Comments visible to network"
--   reactions -> "Reactions visible to network"
-- Both read: post author is me, or an active connection of mine.
--
-- For public.users the permissive TO public policy is dropped here to close the
-- unauthenticated hole immediately. The separate TO authenticated policy
-- "users_select_own_or_username_lookup" (also USING (true), name notwithstanding)
-- is intentionally LEFT IN PLACE by this migration: dropping it requires the
-- can_view_user helper plus the username-lookup RPCs, because an RLS USING
-- clause cannot observe that a query filtered by username. That lands in the
-- follow-up migration for spec 023. This migration therefore closes
-- "anyone on the internet" and leaves "any signed-in user" for that change.
--
-- Not touched: "Anyone can read categories" on public.categories is USING (true)
-- by design -- categories are static reference data with no user content.

drop policy if exists "Network members can see comments" on public.comments;
drop policy if exists "Network members can see reactions" on public.reactions;
drop policy if exists "Users can read any profile" on public.users;
