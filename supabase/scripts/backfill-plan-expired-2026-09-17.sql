-- One-off backfill: plan_expired notifications for the 4 pieces that
-- run-expiry moved to expired + graveyard on 2026-09-17 before the
-- notifications insert failed on the old type check constraint.
-- Idempotent: skips members who already have a plan_expired row for the piece.
-- Run AFTER migration 20260917300000. Emails intentionally not re-sent.

insert into public.notifications (user_id, type, reference_id, read)
select m.user_id, 'plan_expired', g.gum_piece_id, false
from public.graveyard g
join public.gum_piece_members m
  on m.gum_piece_id = g.gum_piece_id and m.status = 'accepted'
where g.expired_at::date = '2026-09-17'
  and not exists (
    select 1 from public.notifications n
    where n.type = 'plan_expired'
      and n.reference_id = g.gum_piece_id
      and n.user_id = m.user_id
  );
