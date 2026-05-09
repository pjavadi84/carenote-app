-- Implements C5 + F4 #5 from the May 2026 Taiwan due-diligence brief: every
-- AI-drafted family communication must carry an explicit reviewer-of-record
-- and a frozen disclosure footer at send time.
--
-- approved_by / approved_at attribute the human who clicked "Send" — this is
-- the regulatory accountability anchor (the Medical Care Act Article 82
-- "physician retains clinical judgment" position).
--
-- disclosure_footer freezes the exact text that was appended to the body so
-- the audit log can later reproduce what the family received, including the
-- reviewing clinician's name and the contact-for-corrections address. Stored
-- separately from body so it can be rendered as a distinct block in admin UI
-- without re-parsing.
--
-- All three columns are nullable + default-null so existing rows backfill
-- cleanly. The send route enforces population on every new send going
-- forward.

ALTER TABLE family_communications
  ADD COLUMN approved_by UUID REFERENCES users(id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN disclosure_footer TEXT;
