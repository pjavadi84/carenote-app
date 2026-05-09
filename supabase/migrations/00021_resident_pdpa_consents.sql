-- F4 #1: PDPA consent capture for resident PHI processing.
--
-- Distinct from consent_records (00017) which captures user/org-level
-- acknowledgments at signup. THIS table captures PER-RESIDENT consent — the
-- resident, or their personal representative, authorizing this organization
-- to process the resident's personal health data through Kinroster and its
-- AI sub-processors (Anthropic, OpenAI, Resend, etc.).
--
-- Append-only by design: a "withdrawal" is recorded by stamping
-- withdrawn_at on the existing row, never by deleting. New consent
-- (re-capture under a newer text version) creates a new row. The active
-- consent for a resident is the most recent row with withdrawn_at IS NULL.
--
-- consent_text_snapshot freezes the EXACT text the consenting party
-- agreed to, so years later we can prove what they actually saw.
-- attorney_reviewed flags whether the snapshot came from attorney-approved
-- copy or from the v0 provisional placeholder; this lets ops identify
-- consents that may need re-capture once attorney copy is finalized.

CREATE TABLE resident_pdpa_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  consenting_party_type TEXT NOT NULL
    CHECK (consenting_party_type IN ('resident', 'personal_representative')),
  consenting_party_name TEXT NOT NULL,
  consenting_party_relationship TEXT,
  -- Last 4 digits of the consenting party's ROC ID, for downstream
  -- verification if a regulator requests proof of identity. Optional.
  consenting_party_id_last4 TEXT,

  consent_text_version TEXT NOT NULL,
  consent_text_locale TEXT NOT NULL,
  consent_text_snapshot TEXT NOT NULL,
  attorney_reviewed BOOLEAN NOT NULL DEFAULT FALSE,

  signed_typed_name TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by_user_id UUID NOT NULL REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,

  withdrawn_at TIMESTAMPTZ,
  withdrawn_by_user_id UUID REFERENCES users(id),
  withdrawal_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resident_pdpa_resident
  ON resident_pdpa_consents (resident_id, consented_at DESC);
CREATE INDEX idx_resident_pdpa_org_active
  ON resident_pdpa_consents (organization_id)
  WHERE withdrawn_at IS NULL;

ALTER TABLE resident_pdpa_consents ENABLE ROW LEVEL SECURITY;

-- Admins manage consent records for their org.
CREATE POLICY "Admins manage org pdpa consents"
  ON resident_pdpa_consents FOR ALL
  USING (organization_id = get_user_org_id() AND is_admin())
  WITH CHECK (organization_id = get_user_org_id() AND is_admin());

-- Caregivers can read consent status for residents in their org (so the
-- caregiver UI can show whether they're allowed to record observations).
CREATE POLICY "Caregivers view org pdpa consents"
  ON resident_pdpa_consents FOR SELECT
  USING (organization_id = get_user_org_id());
