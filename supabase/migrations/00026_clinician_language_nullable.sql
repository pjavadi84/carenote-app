-- Fix the clinical_language default on clinicians.
--
-- Migration 00015 added `clinical_language TEXT NOT NULL DEFAULT 'zh-TW'`
-- with the stated intent that "HIPAA-region clinicians who get this added in
-- their org will read default_clinical_language from their organization."
-- That intent does not match the column shape it produced: because the
-- column is NOT NULL with a Taiwan-tinted default, every clinician on every
-- existing org got 'zh-TW' baked in when 00015 applied — including US/HIPAA
-- orgs whose default_clinical_language is 'en'. The fall-through chain in
-- /api/share/clinician/route.ts:288-292
--
--   const clinicalLanguage =
--     typedClinician.clinical_language       // populated → wins
--     || typedOrg?.default_clinical_language // never read
--     || clinicianLocale.output_language;    // never read
--
-- always returned 'zh-TW' for these clinicians, producing Traditional
-- Chinese clinical summaries on US shares. Confirmed in production on
-- 2026-05-13 when a HIPAA-region facility's first clinician share to
-- Dr. Parham Javadi rendered in zh-TW even though the org's
-- default_clinical_language was 'en'.
--
-- This migration:
--   1. Drops NOT NULL on clinical_language so the column can actually be
--      absent and the route's || chain falls through to the org default.
--   2. Changes the default to NULL — let the org configure its own
--      preferred clinical-output language; per-clinician overrides remain
--      an explicit opt-in rather than the default.
--   3. Backfills clinicians on hipaa_us orgs that still have the migration-
--      injected 'zh-TW' to NULL, restoring the route's fall-through.
--      Taiwan orgs are left alone (their default_clinical_language is
--      'zh-TW' anyway, so the resolved value is unchanged).
--
-- No code changes are required in /api/share/clinician — its existing
-- truthy-`||` chain already handles a null per-clinician language.

ALTER TABLE clinicians
  ALTER COLUMN clinical_language DROP NOT NULL;

ALTER TABLE clinicians
  ALTER COLUMN clinical_language SET DEFAULT NULL;

-- Restore the intended "fall through to org default" behavior on US orgs.
-- Specifically targets rows where the value matches the migration-injected
-- Taiwan default; if an admin has explicitly set zh-TW on a HIPAA-org
-- clinician (e.g., a bilingual Mandarin-speaking specialist), they can
-- re-set it after this runs.
UPDATE clinicians c
SET clinical_language = NULL
FROM organizations o
WHERE c.organization_id = o.id
  AND o.regulatory_region = 'hipaa_us'
  AND c.clinical_language = 'zh-TW';
