-- Week 7 connection request flow updates
-- Run in the Supabase SQL editor.

-- Support enum-based notification type columns.
do $$
begin
  if exists (select 1 from pg_type where typname = 'notification_type') then
    alter type notification_type add value if not exists 'connection_accepted';
  end if;
end $$;

-- Support text + check-constraint based notification type columns.
do $$
declare
  is_text_type boolean;
begin
  select c.data_type = 'text'
  into is_text_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'notifications'
    and c.column_name = 'type';

  if coalesce(is_text_type, false) then
    alter table notifications
      drop constraint if exists notifications_type_check;

    alter table notifications
      add constraint notifications_type_check
      check (
        type in (
          'invite_received',
          'invite_accepted',
          'invite_rejected',
          'plan_turned_down',
          'plan_expiring_soon',
          'plan_expired',
          'bridge_formed',
          'post_comment',
          'post_reaction',
          'connection_request',
          'connection_accepted'
        )
      );
  end if;
end $$;
