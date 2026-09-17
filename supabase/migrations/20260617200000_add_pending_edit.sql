-- Add pending_edit JSONB column to gum_pieces for edit re-proposal flow.
-- Shape: { title?, category?, planned_date?, proposed_by, proposed_at, accepted_by: uuid[] }
ALTER TABLE gum_pieces ADD COLUMN IF NOT EXISTS pending_edit jsonb;
