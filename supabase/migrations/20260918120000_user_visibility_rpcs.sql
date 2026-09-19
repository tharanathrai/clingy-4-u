-- Item 1, part A: the machinery for closing the user-directory leak.
--
-- public.users currently carries "users_select_own_or_username_lookup", which is
-- FOR SELECT TO authenticated USING (true) despite its name -- so any signed-in
-- account can GET /rest/v1/users?select=* and take every profile. That policy is
-- replaced in part B; this migration only ADDS the helper, the RPCs and the
-- indexes, so applying it changes no visibility and is safe to land on its own.
--
-- Why RPCs at all: an RLS USING clause is evaluated per row and cannot observe
-- that the query filtered by username. "Allow an exact-handle lookup" is
-- therefore not expressible as a policy arm -- USING (true) is the only way
-- PostgREST can serve one. The handle paths move here instead.

-- ---------------------------------------------------------------------------
-- can_view_user: may the caller see this profile at all?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: reads connections / gum_piece_members / graveyard with their
--   own RLS bypassed. Evaluating them as the caller would nest policy evaluation
--   (gum_piece_members' policy already calls the definer is_gum_piece_member --
--   precedent: 20260619000000) and would make profile visibility depend
--   transitively on three other policies.
-- STABLE: no writes; lets the planner call it once per candidate row.
-- search_path pinned to '' with fully-qualified names throughout -- the stricter
--   of the two conventions in this repo, and the right one for anything
--   reachable by `authenticated`.
--
-- All four arms are FIRST-DEGREE by design. Second-degree reads (the feed's
-- bridge counterparty, comment authors) are served by the narrow RPCs below
-- instead: a comment-author arm here would grant profile visibility to everyone
-- who has ever commented on any post in the caller's network, which is unbounded
-- and would re-open the leak with extra steps.
create or replace function public.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- self
    target = auth.uid()

    -- Any connections row naming both of us, ANY status. 'pending' covers a
    -- requester we have not accepted yet (the requests screen, the request
    -- sheet, the connection_request notification actor); 'removed' covers an
    -- ex-friend whose expired plans still sit in our graveyard. Pair columns are
    -- sorted on insert, so both orderings must be tested. requested_by needs no
    -- arm of its own -- it is always one of the pair.
    or exists (
      select 1 from public.connections c
      where (c.user_a_id = auth.uid() and c.user_b_id = target)
         or (c.user_b_id = auth.uid() and c.user_a_id = target)
    )

    -- Co-membership in any plan. create-gum-piece only verifies that the
    -- CREATOR is connected to each invitee, so two co-invitees of a group plan
    -- need not be connected to each other -- yet the pocket, /piece/:id and the
    -- confirm ceremony all render their names.
    or exists (
      select 1
      from public.gum_piece_members mine
      join public.gum_piece_members theirs
        on theirs.gum_piece_id = mine.gum_piece_id
      where mine.user_id = auth.uid()
        and theirs.user_id = target
    )

    -- Shared graveyard entry: the scalar 1:1 pair, or the group roster array.
    -- member_ids is uuid[] (verified against prod), so no casts are needed.
    or exists (
      select 1 from public.graveyard g
      where (g.user_a_id = auth.uid() and g.user_b_id = target)
         or (g.user_b_id = auth.uid() and g.user_a_id = target)
         or (g.member_ids @> array[auth.uid(), target])
    );
$$;

revoke all on function public.can_view_user(uuid) from public;
grant execute on function public.can_view_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Username availability
-- ---------------------------------------------------------------------------
-- Returns a bare boolean, never a row: a caller can learn "taken", but cannot
-- map a handle to an id, a display name or an avatar -- which is the entire
-- point of closing the directory. The id <> auth.uid() clause folds in
-- EditProfileSheet's .neq('id', profile.id), so one function serves both call
-- sites (during onboarding auth.uid() simply matches no row yet).
--
-- NOT granted to anon: that would be a free handle oracle for unauthenticated
-- scanners. Onboarding runs after Google sign-in, so `authenticated` is enough.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.users u
    where u.username = lower(btrim(p_username))
      and u.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile lookup by handle
-- ---------------------------------------------------------------------------
-- /profile/:username is a deliberately supported view for someone we are not
-- connected to (useProfile returns isConnected:false with the profile still
-- populated). A stranger therefore gets the profile header -- name, handle,
-- avatar -- and nothing else: bio is free text written for friends, and
-- created_at is an account-age fingerprint. is_visible tells the client which
-- of the two shapes it received.
create or replace function public.get_user_by_username(p_username text)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  is_visible boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.display_name,
    u.username,
    u.avatar_url,
    case when public.can_view_user(u.id) then u.bio end,
    case when public.can_view_user(u.id) then u.created_at end,
    public.can_view_user(u.id)
  from public.users u
  where u.username = lower(btrim(p_username));
$$;

revoke all on function public.get_user_by_username(text) from public;
grant execute on function public.get_user_by_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Second-degree reads, each gated by a resource the caller already has rights to
-- ---------------------------------------------------------------------------

-- Factored out of the posts SELECT policy so the RPC below cannot drift from it.
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (
        p.author_id = auth.uid()
        or exists (
          select 1 from public.connections c
          where c.status = 'active'
            and ((c.user_a_id = auth.uid() and c.user_b_id = p.author_id)
              or (c.user_b_id = auth.uid() and c.user_a_id = p.author_id))
        )
      )
  );
$$;

revoke all on function public.can_view_post(uuid) from public;
grant execute on function public.can_view_post(uuid) to authenticated;

-- Comment authors for ONE post, gated by the caller's right to that post.
-- Required, not nice-to-have: usePost drops any comment whose author row is
-- missing, so without this a comment written by someone outside the viewer's
-- first degree would silently vanish from the thread.
create or replace function public.get_post_comment_authors(p_post_id uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct u.id, u.display_name, u.username, u.avatar_url
  from public.comments cm
  join public.users u on u.id = cm.user_id
  where cm.post_id = p_post_id
    and public.can_view_post(p_post_id);
$$;

revoke all on function public.get_post_comment_authors(uuid) from public;
grant execute on function public.get_post_comment_authors(uuid) to authenticated;

-- Display NAMES ONLY for the feed's "x and y stuck" label -- no ids, usernames,
-- avatars or bios, so this cannot be used to enumerate the directory or to
-- navigate to a stranger's profile. The gate mirrors the existing bridges
-- SELECT policy ("Users can view bridges of their connections").
create or replace function public.get_bridge_participant_names(p_bridge_ids uuid[])
returns table (
  bridge_id uuid,
  user_a_name text,
  user_b_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, ua.display_name, ub.display_name
  from public.bridges b
  join public.users ua on ua.id = b.user_a_id
  join public.users ub on ub.id = b.user_b_id
  where b.id = any(p_bridge_ids)
    and coalesce(array_length(p_bridge_ids, 1), 0) <= 500
    and (
      b.user_a_id = auth.uid()
      or b.user_b_id = auth.uid()
      or exists (
        select 1 from public.connections c
        where c.status = 'active'
          and ((c.user_a_id = auth.uid() and c.user_b_id in (b.user_a_id, b.user_b_id))
            or (c.user_b_id = auth.uid() and c.user_a_id in (b.user_a_id, b.user_b_id)))
      )
    );
$$;

revoke all on function public.get_bridge_participant_names(uuid[]) from public;
grant execute on function public.get_bridge_participant_names(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes for the policy arms
-- ---------------------------------------------------------------------------
-- connections(user_a_id), connections(user_b_id), gum_piece_members(user_id) and
-- gum_piece_members(gum_piece_id) already exist. graveyard has only its pkey,
-- and comments has no post_id index.
create index if not exists graveyard_user_a_idx     on public.graveyard (user_a_id);
create index if not exists graveyard_user_b_idx     on public.graveyard (user_b_id);
create index if not exists graveyard_member_ids_gin on public.graveyard using gin (member_ids);
create index if not exists comments_post_id_idx     on public.comments (post_id);
