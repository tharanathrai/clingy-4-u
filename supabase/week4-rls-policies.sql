-- Users can view bridges belonging to people they are connected to
-- (needed to show edge weights between other nodes in the graph)
drop policy if exists "Users can view bridges of their connections" on bridges;

create policy "Users can view bridges of their connections"
on bridges for select
using (
  auth.uid() = user_a_id
  or auth.uid() = user_b_id
  or exists (
    select 1
    from connections
    where status = 'active'
      and (
        (user_a_id = auth.uid() and user_b_id = bridges.user_a_id)
        or (user_a_id = auth.uid() and user_b_id = bridges.user_b_id)
        or (user_b_id = auth.uid() and user_a_id = bridges.user_a_id)
        or (user_b_id = auth.uid() and user_a_id = bridges.user_b_id)
      )
  )
);
