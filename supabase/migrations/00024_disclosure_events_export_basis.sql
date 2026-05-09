-- F4 #3: Role-based PHI export controls.
--
-- The /api/residents/[id]/export endpoint pulls every PHI table for a
-- resident into a single JSON download. Today the route accepts no
-- parameters, requires only "admin" or "compliance_admin", logs a
-- minimal disclosure_event with recipient_type="agency_internal" and
-- legal_basis="operations". That covers the "internal admin
-- backed-up the chart" case but mis-categorizes every other reason
-- a chart legitimately leaves the system: portability requests
-- (PDPA Article 10), continuity-of-care transfers, regulator audits,
-- subpoena responses.
--
-- This migration extends the disclosure_events CHECK enums so the
-- export route can record the actual recipient + legal basis without
-- lying. New recipient_type values: 'patient_or_guardian',
-- 'other_facility', 'regulator', 'legal_request'. New legal_basis
-- values: 'patient_request' (data portability),
-- 'continuity_of_care' (transfer to new facility),
-- 'regulatory_request' (regulator audit),
-- 'subpoena_or_court_order'.
--
-- DROP+ADD pattern is used for CHECK constraints — Postgres has no
-- ALTER CONSTRAINT for CHECK. Names are inferred from the original
-- 00005 migration where the constraints were created inline (so the
-- system named them disclosure_events_recipient_type_check and
-- disclosure_events_legal_basis_check).

ALTER TABLE disclosure_events
  DROP CONSTRAINT disclosure_events_recipient_type_check,
  ADD CONSTRAINT disclosure_events_recipient_type_check
    CHECK (recipient_type IN (
      'clinician',
      'family_contact',
      'agency_internal',
      'legal_rep',
      'patient_or_guardian',
      'other_facility',
      'regulator',
      'legal_request'
    ));

ALTER TABLE disclosure_events
  DROP CONSTRAINT disclosure_events_legal_basis_check,
  ADD CONSTRAINT disclosure_events_legal_basis_check
    CHECK (legal_basis IN (
      'treatment',
      'operations',
      'patient_authorization',
      'patient_agreement',
      'professional_judgment',
      'personal_representative',
      'patient_request',
      'continuity_of_care',
      'regulatory_request',
      'subpoena_or_court_order'
    ));
