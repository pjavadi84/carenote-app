-- F4 #1 (continued): per-family-contact PDPA consent.
--
-- Distinct from resident_pdpa_consents (the resident's PHI processing
-- consent). THIS table records consent from the FAMILY MEMBER themselves
-- to receive AI-drafted updates by email and to have their contact data
-- (name, email, relationship) processed by the organization.
--
-- A family contact's existing authorization_on_file / personal_representative
-- / involved_in_care fields capture the HIPAA-style basis for SHARING the
-- resident's information with the family member. This separate consent
-- captures the family member's OWN consent for the org to process THEIR
-- contact data and email them. Both bases are required under PDPA.
--
-- Append-only by design: withdrawal stamps withdrawn_at on the existing
-- row. Active consent = most recent row with withdrawn_at IS NULL.

CREATE TABLE family_contact_pdpa_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_contact_id UUID NOT NULL REFERENCES family_contacts(id) ON DELETE CASCADE,

  -- Family contacts are typically the consenting party themselves, but in
  -- some Taiwan elder-care contexts an in-person admin captures the
  -- consent during a phone call from a family member who can't access
  -- the system. consenting_party_name records who actually gave assent.
  consenting_party_name TEXT NOT NULL,

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

CREATE INDEX idx_fc_pdpa_contact
  ON family_contact_pdpa_consents (family_contact_id, consented_at DESC);
CREATE INDEX idx_fc_pdpa_org_active
  ON family_contact_pdpa_consents (organization_id)
  WHERE withdrawn_at IS NULL;

ALTER TABLE family_contact_pdpa_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage org family-contact pdpa consents"
  ON family_contact_pdpa_consents FOR ALL
  USING (organization_id = get_user_org_id() AND is_admin())
  WITH CHECK (organization_id = get_user_org_id() AND is_admin());

CREATE POLICY "Org members view family-contact pdpa consents"
  ON family_contact_pdpa_consents FOR SELECT
  USING (organization_id = get_user_org_id());
