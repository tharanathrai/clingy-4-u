-- Group plans: multi-member support for gum_pieces

-- 1. Create gum_piece_members table
CREATE TABLE gum_piece_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gum_piece_id uuid NOT NULL REFERENCES gum_pieces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('creator', 'invitee')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (gum_piece_id, user_id)
);

CREATE INDEX ON gum_piece_members (user_id);
CREATE INDEX ON gum_piece_members (gum_piece_id);

-- 2. Backfill: creator row (always accepted)
INSERT INTO gum_piece_members (gum_piece_id, user_id, role, status, invited_at, responded_at)
SELECT id, creator_id, 'creator', 'accepted', created_at, created_at
FROM gum_pieces
ON CONFLICT DO NOTHING;

-- 3. Backfill: recipient row (status derived from plan state)
INSERT INTO gum_piece_members (gum_piece_id, user_id, role, status, invited_at, responded_at)
SELECT
  id,
  recipient_id,
  'invitee',
  CASE
    WHEN status IN ('active', 'confirmed') THEN 'accepted'
    WHEN status = 'turned_down' THEN 'declined'
    ELSE 'pending'
  END,
  created_at,
  accepted_at
FROM gum_pieces
WHERE recipient_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Make recipient_id nullable (new group plans won't set it)
ALTER TABLE gum_pieces ALTER COLUMN recipient_id DROP NOT NULL;

-- 5. Add confirmed_member_ids array to confirmation_sessions
ALTER TABLE confirmation_sessions
  ADD COLUMN confirmed_member_ids uuid[] NOT NULL DEFAULT '{}';

-- 6. Backfill in-progress sessions from old bool flags
UPDATE confirmation_sessions
SET confirmed_member_ids = ARRAY[initiator_id]
WHERE initiator_confirmed = true AND responder_confirmed = false;

UPDATE confirmation_sessions cs
SET confirmed_member_ids = ARRAY[
  cs.initiator_id,
  (
    SELECT gpm.user_id
    FROM gum_piece_members gpm
    WHERE gpm.gum_piece_id = cs.gum_piece_id
      AND gpm.user_id <> cs.initiator_id
      AND gpm.status = 'accepted'
    LIMIT 1
  )
]
WHERE cs.initiator_confirmed = true AND cs.responder_confirmed = true;

-- 7. Drop old binary confirmation columns
ALTER TABLE confirmation_sessions
  DROP COLUMN initiator_confirmed,
  DROP COLUMN responder_confirmed;

-- 8. Add member_ids array to graveyard for group plans
ALTER TABLE graveyard
  ADD COLUMN member_ids uuid[] NOT NULL DEFAULT '{}';

-- 9. Backfill graveyard member_ids from existing pairs
UPDATE graveyard
SET member_ids = ARRAY[user_a_id, user_b_id];
