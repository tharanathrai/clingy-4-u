-- Version the storage.objects policies for the `avatars` bucket.
--
-- These three existed in prod but only in the Dashboard -- storage policies were
-- never in the repo, the same gap class as the retired week*.sql RLS files.
-- Captured verbatim from pg_policies on 2026-09-18 (roles, cmd, qual and
-- with_check all match prod), so applying this is a no-op that puts the repo
-- back in charge of them.
--
-- Note the inconsistency, preserved deliberately rather than "fixed" blind:
-- INSERT is gated on the path prefix, while UPDATE and DELETE are gated on the
-- `owner` column. An object whose `owner` is null therefore cannot be removed
-- by its own uploader from the browser; supabase/scripts/prune-orphan-avatars.md
-- is the service-role backstop for those.
--
-- There is intentionally NO SELECT policy. Public reads of this bucket go
-- through the public-object endpoint, which does not consult RLS, so adding one
-- would only grant `list()` on the prefix -- and nothing needs it: the live
-- cleanup path derives the object path from users.avatar_url
-- (src/lib/avatarCleanup.ts#avatarPathFromUrl) instead of enumerating. Adding a
-- SELECT policy later would let any authenticated user enumerate the objects it
-- covers, so it should not be added without a reason.

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
