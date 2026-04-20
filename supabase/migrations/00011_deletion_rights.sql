-- Phase 8: data subject rights (soft-delete + tombstone ledger).
--
-- Adds a 'deleted_pending' state to the residents status enum so admins
-- can mark a resident for deletion without losing data while they
-- verify the action was intentional. A separate admin action (Purge)
-- writes a deletion_ledger row and then hard-deletes the resident
-- (ON DELETE CASCADE clears notes, incidents, family, etc).
--
-- deletion_ledger is append-only. It stores:
--   - an unsalted SHA-256 hash of the resident's full name + dob
--     (enough for dedup / auditors to spot repeated deletion of the
--     same person without keeping PHI)
--   - who did it, when, and why
--   - a snapshot of the last-known status for context
-- No personal identifiers are kept in plaintext.

-- ============================================
-- Allow the deleted_pending state on residents
-- ============================================
ALTER TABLE residents DROP CONSTRAINT IF EXISTS residents_status_check;
ALTER TABLE residents ADD CONSTRAINT residents_status_check
  CHECK (status IN ('active', 'discharged', 'deceased', 'deleted_pending'));

-- ============================================
-- Deletion ledger
-- ============================================
CREATE TABLE deletion_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resident_id UUID,  -- nullable — populated at purge time, nulled by cascade
  resident_name_hash TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL
);

ALTER TABLE deletion_ledger ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_deletion_ledger_org_created
  ON deletion_ledger (organization_id, deleted_at DESC);
CREATE INDEX idx_deletion_ledger_hash
  ON deletion_ledger (resident_name_hash);

-- Admin read within org. INSERT via service-role (the API route hashes
-- the name server-side, then inserts); no UPDATE / DELETE policies so
-- the ledger is append-only.
CREATE POLICY "Admins can view org deletion ledger"
  ON deletion_ledger FOR SELECT
  USING (organization_id = get_user_org_id() AND is_admin());
