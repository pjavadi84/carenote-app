-- Phase 12: family contact email confirmation flow.
--
-- Why this exists: a typo in a family contact's email address (e.g.
-- mbadiee@gmail.com when the real address was mbadiee83@gmail.com) caused two
-- shift updates containing PHI to be delivered to the wrong gmail account.
-- Resend reports "Delivered" once Gmail's SMTP server accepts the message,
-- but acceptance does not mean the intended recipient received it.
--
-- The fix is a recipient-side opt-in: when an admin adds a family contact,
-- the system emails the recipient a single-use confirmation link. Until the
-- recipient clicks the link (proving the address is reachable AND that they
-- consent to receive updates), the /api/family/send route refuses to send
-- substantive PHI emails to that contact.
--
-- This mirrors the clinician magic-link pattern in 00005 (SHA-256 hash of a
-- 256-bit random token, expiry, revocation), but with one extra column —
-- confirmed_at — that captures the recipient's click. The send-gate reads a
-- denormalized email_confirmed_at column on family_contacts itself so the
-- hot path is one row lookup instead of a join.

-- ============================================
-- Family contact email confirmation tokens
-- ============================================
CREATE TABLE family_contact_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_contact_id UUID NOT NULL REFERENCES family_contacts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_at_send TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE family_contact_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_fcct_token_hash ON family_contact_confirmation_tokens (token_hash);
CREATE INDEX idx_fcct_family_contact ON family_contact_confirmation_tokens (family_contact_id, created_at DESC);
CREATE INDEX idx_fcct_active ON family_contact_confirmation_tokens (organization_id, expires_at)
  WHERE revoked_at IS NULL AND confirmed_at IS NULL;

-- Denormalized column on family_contacts: read at send time to decide whether
-- the gate allows sending. Updated by the confirm route (service-role) when a
-- token is redeemed, and cleared by application code when an admin changes
-- the contact's email address (a new address means a new confirmation cycle).
ALTER TABLE family_contacts
  ADD COLUMN email_confirmed_at TIMESTAMPTZ;

-- Grandfather existing contacts. Without this, every previously-working
-- contact would be blocked on day-of-deploy because none of them have a
-- confirmation row. We treat created_at as the implicit confirmation time —
-- the admin has historically vouched for these addresses, and several have
-- successfully received earlier sends.
UPDATE family_contacts
SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL
  AND email IS NOT NULL;

-- ============================================
-- RLS policies
-- ============================================
-- The public confirm route uses createAdminClient() (service-role) to bypass
-- RLS — same model as the clinician portal. RLS here only governs admin
-- visibility/control inside the app.
CREATE POLICY "Admins can view family contact confirmation tokens"
  ON family_contact_confirmation_tokens FOR SELECT
  USING (organization_id = get_user_org_id() AND is_admin());

CREATE POLICY "Admins can insert family contact confirmation tokens"
  ON family_contact_confirmation_tokens FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND is_admin()
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update family contact confirmation tokens"
  ON family_contact_confirmation_tokens FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_admin());
