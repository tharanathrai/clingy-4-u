# Prune orphaned avatar objects

One-off, owner-run. Removes avatar objects in the public `avatars` bucket that no
`users.avatar_url` points at.

## Why these exist

Until 2026-09-18, `uploadAvatar` wrote a new object on every avatar change and
nothing ever removed the old one, and "remove photo" in Edit Profile set
`users.avatar_url = null` while leaving the object in place. The bucket is
public, so every one of those objects is still fetchable by anyone holding its
URL — including photos a user believes they deleted.

New changes are cleaned up inline (`removeAvatarByUrl` in
`src/hooks/useAvatarUpload.ts`). This script is only for the historical backlog.

## Why it can't be pure SQL

`storage.objects` has a `protect_delete` trigger, so `delete from storage.objects`
is refused — removal has to go through the Storage API. And the browser can't do
it either: there is **no SELECT policy** on `storage.objects`, so
`storage.from('avatars').list(prefix)` returns `[]` for an authenticated client.
Listing therefore needs the service-role key, which bypasses RLS.

## 1. See what is orphaned (read-only)

```sh
npx supabase db query --linked "
  select o.name
  from storage.objects o
  where o.bucket_id = 'avatars'
    and not exists (
      select 1 from public.users u
      where u.avatar_url like '%/avatars/' || o.name
    )
  order by o.name;"
```

Sanity-check the counts before removing anything:

```sh
npx supabase db query --linked "
  select
    count(*)                                              as objects,
    count(*) filter (where owner is null)                 as owner_null,
    (select count(*) from public.users
      where avatar_url is not null)                       as profiles_with_avatar
  from storage.objects where bucket_id = 'avatars';"
```

`objects - profiles_with_avatar` is roughly what should be removed. If
`objects` is *lower* than `profiles_with_avatar`, stop — some profile points at
an object that no longer exists, and the prune list may be wrong.

## 2. Remove them

Needs the service-role key, which is **not** in `.env.local` — copy it from
Dashboard → Project Settings → API, and do not commit it.

```sh
SUPABASE_URL='https://<ref>.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
node --input-type=module -e "
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: users, error: uErr } = await db.from('users').select('avatar_url')
if (uErr) throw uErr
const live = new Set(
  users.map((u) => u.avatar_url).filter(Boolean)
       .map((url) => url.split('?')[0].split('/avatars/')[1])
       .filter(Boolean),
)

const { data: prefixes, error: pErr } = await db.storage.from('avatars').list('', { limit: 1000 })
if (pErr) throw pErr

const orphans = []
for (const prefix of prefixes.filter((p) => p.id === null)) {
  const { data: objects, error } = await db.storage.from('avatars').list(prefix.name, { limit: 1000 })
  if (error) throw error
  for (const object of objects.filter((o) => o.id !== null)) {
    const path = prefix.name + '/' + object.name
    if (!live.has(path)) orphans.push(path)
  }
}

console.log('live:', live.size, 'orphans:', orphans.length)
console.log(orphans.join('\n'))

if (process.env.APPLY === '1') {
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100)
    const { error } = await db.storage.from('avatars').remove(batch)
    if (error) throw error
    console.log('removed', batch.length)
  }
} else {
  console.log('dry run — re-run with APPLY=1 to remove')
}
"
```

It is a dry run unless `APPLY=1` is set. Read the orphan list first — note that
top-level entries with `id === null` are folder prefixes, and passing those to
`.remove()` deletes nothing, which is why the script descends into each prefix.

## 3. Verify

Re-run the read-only query from step 1; it should return no rows. Then spot-check
that a current avatar still loads in the app, and that one of the removed URLs
now 404s.
