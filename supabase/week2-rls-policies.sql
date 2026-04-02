-- gum_pieces: users can view pieces they are part of
create policy "Users can view their own gum pieces"
on gum_pieces for select
using (auth.uid() = creator_id or auth.uid() = recipient_id);

-- gum_pieces: users can update pieces they are part of
create policy "Users can update their own gum pieces"
on gum_pieces for update
using (auth.uid() = creator_id or auth.uid() = recipient_id);

-- notifications: users can view their own
create policy "Users can view their own notifications"
on notifications for select
using (auth.uid() = user_id);

-- notifications: users can mark their own as read
create policy "Users can update their own notifications"
on notifications for update
using (auth.uid() = user_id);
