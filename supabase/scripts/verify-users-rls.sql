-- Verify the public.users SELECT policy: does it hide the directory without
-- breaking any read path the app depends on?
--
-- Read-only. Runs inside a transaction and always ends in ROLLBACK.
--
-- Run it TWICE:
--   * before 20260918120001 (policy still USING (true)) -- every COVERAGE
--     assertion must already pass, proving the arms cover what the app needs
--     before they become load-bearing. LEAKAGE will report "directory is open".
--   * after  20260918120001 -- COVERAGE must still pass and LEAKAGE must flip
--     to "directory is closed".
--
-- Usage:
--   npx supabase db query --linked "$(cat supabase/scripts/verify-users-rls.sql)"
--
-- THE GOTCHA: migrations and psql sessions run as the table OWNER, which
-- bypasses RLS entirely. Without `set local role authenticated` every row looks
-- visible and this script would happily "pass" against a wide-open table. That
-- is why every measurement below goes through set_config + set local role.
--
-- No fixtures to fill in: it iterates every user as a viewer, so whatever
-- shapes exist in the data (a pending request, a removed friend still in a
-- graveyard, a 3+ person group plan) are exercised automatically.

begin;

do $$
declare
  v_viewer        uuid;
  v_total         bigint;
  v_visible       bigint;
  v_expected      bigint;
  v_missing       bigint;
  v_pairs_visible bigint := 0;
  v_pairs_total   bigint;
  v_failures      text := '';
begin
  select count(*) into v_total from public.users;
  v_pairs_total := v_total * v_total;

  for v_viewer in select id from public.users loop
    -- Become this user for the duration of the measurement.
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_viewer, 'role', 'authenticated')::text,
      true
    );
    set local role authenticated;

    select count(*) into v_visible from public.users;

    reset role;

    -- Everything the app must still be able to render for this viewer:
    -- self, any connection at any status (pending requester, removed friend),
    -- every co-member of a shared plan, every graveyard partner.
    with expected as (
      select v_viewer as id
      union
      select case when c.user_a_id = v_viewer then c.user_b_id else c.user_a_id end
        from public.connections c
       where c.user_a_id = v_viewer or c.user_b_id = v_viewer
      union
      select theirs.user_id
        from public.gum_piece_members mine
        join public.gum_piece_members theirs on theirs.gum_piece_id = mine.gum_piece_id
       where mine.user_id = v_viewer
      union
      select case when g.user_a_id = v_viewer then g.user_b_id else g.user_a_id end
        from public.graveyard g
       where g.user_a_id = v_viewer or g.user_b_id = v_viewer
      union
      select unnest(g.member_ids)
        from public.graveyard g
       where g.member_ids @> array[v_viewer]
    )
    select count(*) into v_expected from expected where id is not null;

    -- Re-measure per expected row under the viewer's own RLS.
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_viewer, 'role', 'authenticated')::text,
      true
    );
    set local role authenticated;

    with expected as (
      select v_viewer as id
      union
      select case when c.user_a_id = v_viewer then c.user_b_id else c.user_a_id end
        from public.connections c
       where c.user_a_id = v_viewer or c.user_b_id = v_viewer
      union
      select theirs.user_id
        from public.gum_piece_members mine
        join public.gum_piece_members theirs on theirs.gum_piece_id = mine.gum_piece_id
       where mine.user_id = v_viewer
      union
      select case when g.user_a_id = v_viewer then g.user_b_id else g.user_a_id end
        from public.graveyard g
       where g.user_a_id = v_viewer or g.user_b_id = v_viewer
      union
      select unnest(g.member_ids)
        from public.graveyard g
       where g.member_ids @> array[v_viewer]
    )
    select count(*) into v_missing
      from expected e
     where e.id is not null
       and not exists (select 1 from public.users u where u.id = e.id);

    reset role;

    v_pairs_visible := v_pairs_visible + v_visible;

    -- COVERAGE: an arm is missing and some screen will render "Unknown".
    if v_missing > 0 then
      v_failures := v_failures
        || format(E'\n  COVERAGE: viewer %s cannot see %s of %s people it must render',
                  v_viewer, v_missing, v_expected);
    end if;
  end loop;

  raise notice 'users: %, viewer/target pairs visible: % of % (lower is tighter)',
    v_total, v_pairs_visible, v_pairs_total;

  if v_pairs_visible >= v_pairs_total then
    raise notice 'LEAKAGE: directory is OPEN -- every user can see every user. Expected before 20260918120001, a FAILURE after it.';
  else
    raise notice 'LEAKAGE: directory is closed -- % pairs hidden.', v_pairs_total - v_pairs_visible;
  end if;

  if v_failures <> '' then
    raise exception 'users RLS verification FAILED:%', v_failures;
  end if;

  raise notice 'COVERAGE: ok -- every viewer can still see everyone the app needs to render.';
end $$;

-- RPC behaviour, measured as a real signed-in user (the first one with a handle).
do $$
declare
  v_viewer   uuid;
  v_handle   text;
  v_stranger uuid;
  v_taken    boolean;
  v_free     boolean;
  v_rows     bigint;
begin
  select id, username into v_viewer, v_handle from public.users order by created_at limit 1;

  -- Someone this viewer has no relationship with, if the data contains one.
  select u.id into v_stranger
    from public.users u
   where u.id <> v_viewer
     and not exists (
       select 1 from public.connections c
        where (c.user_a_id = v_viewer and c.user_b_id = u.id)
           or (c.user_b_id = v_viewer and c.user_a_id = u.id))
   limit 1;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_viewer, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  select public.is_username_available(v_handle)                 into v_taken;
  select public.is_username_available('zz_definitely_free_zz')  into v_free;

  if v_taken then
    raise exception 'is_username_available returned true for the existing handle %', v_handle;
  end if;
  if not v_free then
    raise exception 'is_username_available returned false for an unused handle';
  end if;

  -- Keeping your OWN handle must still read as available (this is what the old
  -- .neq(id) in EditProfileSheet did; onboarding and profile edit both rely on it).
  select count(*) into v_rows from public.get_user_by_username(v_handle);
  if v_rows <> 1 then
    raise exception 'get_user_by_username returned % rows for own handle', v_rows;
  end if;

  if v_stranger is not null then
    declare
      v_stranger_handle text;
      v_vis             boolean;
      v_bio             text;
    begin
      reset role;
      select username into v_stranger_handle from public.users where id = v_stranger;

      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', v_viewer, 'role', 'authenticated')::text,
        true
      );
      set local role authenticated;

      select is_visible, bio into v_vis, v_bio
        from public.get_user_by_username(v_stranger_handle);

      if v_vis then
        raise notice 'note: %, treated as visible -- they share a plan or graveyard entry with the viewer', v_stranger_handle;
      elsif v_bio is not null then
        raise exception 'get_user_by_username leaked a bio for a non-visible profile';
      else
        raise notice 'RPC: stranger lookup returns header only, bio withheld. ok';
      end if;
    end;
  end if;

  reset role;
  raise notice 'RPC: ok';
end $$;

rollback;
