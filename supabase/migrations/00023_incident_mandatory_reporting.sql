-- F4 #6: Statutory mandatory-reporting workflow for incident reports.
--
-- Taiwan's Senior Citizens Welfare Act (老人福利法) and Long-Term Care
-- Services Act (長期照顧服務法) impose same-day or 24-hour mandatory
-- reporting on residential care facilities for certain incident types
-- (death, serious injury, suspected abuse, missing resident, communicable
-- disease outbreak, significant medication error). Failure to file a
-- timely report carries criminal liability for the responsible person at
-- the facility and license risk for the facility.
--
-- This migration adds tracking fields to incident_reports so the system
-- can surface "X reports overdue" to the surgeon and produce an audit
-- trail of who filed which report, when, with what reference number.
-- Kinroster does NOT submit reports to authorities — submission methods
-- (online portal, fax, in-person) are out of band; this is a
-- responsibility-tracking aid, not a submission system.
--
-- All columns are nullable + default-null so existing rows backfill
-- cleanly. The classifier (src/lib/incidents/mandatory-reporting.ts)
-- populates `mandatory_report_required` + `mandatory_report_authority`
-- + `mandatory_report_deadline_at` at incident-report create time, and
-- the admin marks submitted via /api/incidents/[id]/mandatory-report.
--
-- Off by default for non-Taiwan orgs (regulatory_region != pdpa_tw):
-- US / EU have separate reporting regimes outside this PR's scope, so
-- the classifier short-circuits to required=false there and the UI
-- hides the section.

ALTER TABLE incident_reports
  -- Three-state semantics:
  --   NULL  = not yet classified (legacy rows, future regions)
  --   TRUE  = classifier flagged as triggering statutory reporting
  --   FALSE = classifier reviewed and cleared (no statutory trigger)
  ADD COLUMN mandatory_report_required BOOLEAN,
  -- Free-text authority slug. Examples for Taiwan:
  --   "social_welfare_bureau" (社會局/處 — for elder welfare incidents)
  --   "long_term_care_dept"   (長照處 — for LTC service incidents)
  --   "police"                (警察局 — for missing residents, criminal abuse)
  --   "cdc"                   (疾管署 — for communicable disease outbreaks)
  --   "nhi"                   (健保署 — for medication errors with NHI implications)
  ADD COLUMN mandatory_report_authority TEXT,
  -- Deadline for filing the report — typically created_at + 24 hours
  -- under §43 of the Senior Citizens Welfare Act.
  ADD COLUMN mandatory_report_deadline_at TIMESTAMPTZ,
  -- Statute reference text (e.g., "Senior Citizens Welfare Act §43-2")
  -- captured at classification time so the audit trail explains why
  -- the report was flagged. Frozen — the classifier may be updated
  -- later but historical rows keep the basis they were filed under.
  ADD COLUMN mandatory_report_legal_basis TEXT,
  -- Stamps for the actual filing.
  ADD COLUMN mandatory_report_submitted_at TIMESTAMPTZ,
  ADD COLUMN mandatory_report_submitted_by UUID REFERENCES users(id),
  ADD COLUMN mandatory_report_method TEXT,
  ADD COLUMN mandatory_report_reference TEXT,
  ADD COLUMN mandatory_report_notes TEXT;

-- Index for the dashboard "overdue reports" query: any incident where
-- the report was required, the deadline has passed, and submission
-- hasn't been recorded yet.
CREATE INDEX idx_incidents_overdue_mandatory_report
  ON incident_reports (organization_id, mandatory_report_deadline_at)
  WHERE mandatory_report_required = TRUE
    AND mandatory_report_submitted_at IS NULL;
