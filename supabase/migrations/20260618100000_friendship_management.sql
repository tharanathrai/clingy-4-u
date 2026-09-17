-- Friendship management: snooze and remove friend

-- 1. Extend connections status to include 'removed'
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;
ALTER TABLE connections ADD CONSTRAINT connections_status_check
  CHECK (status IN ('pending', 'active', 'removed'));

-- 2. Per-side snooze flags (a = user_a_id side, b = user_b_id side)
ALTER TABLE connections
  ADD COLUMN snoozed_by_a boolean NOT NULL DEFAULT false,
  ADD COLUMN snoozed_by_b boolean NOT NULL DEFAULT false;

-- 3. snooze_friend RPC
CREATE OR REPLACE FUNCTION snooze_friend(other_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  UPDATE connections SET snoozed_by_a = true
    WHERE user_a_id = uid AND user_b_id = other_user_id AND status = 'active';
  UPDATE connections SET snoozed_by_b = true
    WHERE user_b_id = uid AND user_a_id = other_user_id AND status = 'active';
END;
$$;

-- 4. unsnooze_friend RPC
CREATE OR REPLACE FUNCTION unsnooze_friend(other_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  UPDATE connections SET snoozed_by_a = false
    WHERE user_a_id = uid AND user_b_id = other_user_id AND status = 'active';
  UPDATE connections SET snoozed_by_b = false
    WHERE user_b_id = uid AND user_a_id = other_user_id AND status = 'active';
END;
$$;

-- 5. remove_friend RPC: soft-delete connection + expire 1-on-1 plans → graveyard
CREATE OR REPLACE FUNCTION remove_friend(other_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  conn_id uuid;
BEGIN
  SELECT id INTO conn_id
  FROM connections
  WHERE status = 'active'
    AND (
      (user_a_id = uid AND user_b_id = other_user_id) OR
      (user_b_id = uid AND user_a_id = other_user_id)
    );

  IF conn_id IS NULL THEN
    RAISE EXCEPTION 'No active connection found between these users';
  END IF;

  -- Soft-delete the connection
  UPDATE connections SET status = 'removed' WHERE id = conn_id;

  -- Expire all active/placeholder 1-on-1 plans and write to graveyard
  WITH expired AS (
    UPDATE gum_pieces
    SET status = 'expired', expires_at = now()
    WHERE status IN ('placeholder', 'active')
      AND (
        (creator_id = uid AND recipient_id = other_user_id) OR
        (creator_id = other_user_id AND recipient_id = uid)
      )
    RETURNING id, creator_id, recipient_id, title, category, color_hex, created_at
  )
  INSERT INTO graveyard
    (gum_piece_id, user_a_id, user_b_id, member_ids, title, category, color_hex, created_at, expired_at)
  SELECT
    id,
    creator_id,
    recipient_id,
    ARRAY[creator_id, recipient_id],
    title,
    category,
    color_hex,
    created_at,
    now()
  FROM expired;
END;
$$;

GRANT EXECUTE ON FUNCTION snooze_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unsnooze_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated;
