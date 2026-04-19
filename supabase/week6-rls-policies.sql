-- Week 6 feed visibility and write policies
-- Run in the Supabase SQL editor.

-- Posts: visible only to author + active mutual connections.
drop policy if exists "Posts visible to network" on posts;
create policy "Posts visible to network"
on posts for select
using (
  auth.uid() = author_id
  or exists (
    select 1
    from connections
    where status = 'active'
      and (
        (user_a_id = auth.uid() and user_b_id = posts.author_id)
        or (user_b_id = auth.uid() and user_a_id = posts.author_id)
      )
  )
);

drop policy if exists "Users can insert their own posts" on posts;
create policy "Users can insert their own posts"
on posts for insert
with check (auth.uid() = author_id);

drop policy if exists "Users can update their own posts" on posts;
create policy "Users can update their own posts"
on posts for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- Reactions: visible to anyone who can view the related post.
drop policy if exists "Reactions visible to network" on reactions;
create policy "Reactions visible to network"
on reactions for select
using (
  exists (
    select 1
    from posts
    where posts.id = reactions.post_id
      and (
        posts.author_id = auth.uid()
        or exists (
          select 1
          from connections
          where status = 'active'
            and (
              (user_a_id = auth.uid() and user_b_id = posts.author_id)
              or (user_b_id = auth.uid() and user_a_id = posts.author_id)
            )
        )
      )
  )
);

drop policy if exists "Users can react to posts" on reactions;
create policy "Users can react to posts"
on reactions for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reactions" on reactions;
create policy "Users can delete their own reactions"
on reactions for delete
using (auth.uid() = user_id);

-- Comments: same visibility model as posts.
drop policy if exists "Comments visible to network" on comments;
create policy "Comments visible to network"
on comments for select
using (
  exists (
    select 1
    from posts
    where posts.id = comments.post_id
      and (
        posts.author_id = auth.uid()
        or exists (
          select 1
          from connections
          where status = 'active'
            and (
              (user_a_id = auth.uid() and user_b_id = posts.author_id)
              or (user_b_id = auth.uid() and user_a_id = posts.author_id)
            )
        )
      )
  )
);

drop policy if exists "Users can insert comments" on comments;
create policy "Users can insert comments"
on comments for insert
with check (auth.uid() = user_id);
