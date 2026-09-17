-- Widen notifications.type check constraint to every type the app emits.
--
-- Prod allowed 9 types; edge functions insert 15. The six missing ones
-- (plan_expired, connection_accepted, confirmation_started,
-- plan_edit_proposed / plan_edit_accepted / plan_edit_declined) were rejected
-- on insert. Most callers treat the notification insert as non-fatal, so
-- those notifications were silently never delivered; run-expiry surfaced it
-- as a 500 on 2026-09-17. Client routing for all 15 already exists
-- (src/lib/notificationRouting.ts, src/pages/Notifications.tsx).

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'invite_received',
    'invite_accepted',
    'invite_rejected',
    'plan_turned_down',
    'plan_expiring_soon',
    'plan_expired',
    'plan_edit_proposed',
    'plan_edit_accepted',
    'plan_edit_declined',
    'confirmation_started',
    'bridge_formed',
    'post_comment',
    'post_reaction',
    'connection_request',
    'connection_accepted'
  ]::text[])
);
