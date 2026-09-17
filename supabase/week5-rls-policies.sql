-- Week 5 profile visibility policies
-- Run in the Supabase SQL editor.

-- users: public profiles are readable by anyone.
drop policy if exists "Profiles are publicly viewable" on users;
create policy "Profiles are publicly viewable"
on users for select
using (true);

-- users: only profile owner can update their row.
drop policy if exists "Users can update their own profile" on users;
create policy "Users can update their own profile"
on users for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- connections: users can only view rows where they are part of the connection.
drop policy if exists "Users can view their own connections" on connections;
create policy "Users can view their own connections"
on connections for select
using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- bridges: Week 4 policy should already cover shared-bridge visibility on profiles.
-- Verify this policy exists:
--   "Users can view bridges of their connections"
