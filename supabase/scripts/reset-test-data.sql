-- Reset all test data for a fresh testing run.
-- Run in: Supabase Dashboard -> SQL Editor (runs as service_role, bypasses RLS).
-- DESTRUCTIVE + IRREVERSIBLE. Wipes every account and all user-generated data.
-- Categories are NOT in the DB (code constants), so nothing seed-like is touched.

begin;

-- 1) Clear all user-generated data tables.
--    CASCADE handles FK dependency order automatically.
truncate table
  public.gum_piece_members,
  public.gum_pieces,
  public.confirmation_sessions,
  public.bridges,
  public.connections,
  public.posts,
  public.comments,
  public.reactions,
  public.notifications,
  public.rotating_qr_tokens,
  public.graveyard,
  public.users
restart identity cascade;

-- 2) Avatars storage bucket: cannot delete via SQL (storage.protect_delete).
--    Clear separately via Storage API / Dashboard (see note below).

-- 3) Delete the accounts themselves.
--    Any public.* rows FK'd to auth.users with ON DELETE CASCADE are already
--    gone via step 1; this removes the auth identities.
delete from auth.users;

commit;
