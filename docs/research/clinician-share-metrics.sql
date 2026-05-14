-- Clinician-share usage metrics — reusable diagnostic queries.
--
-- Run against kinroster-prod (dqjxlovjehhdoehiehyo) during the validation
-- window (target: 2026-05). All data is already captured in
-- clinician_share_links and disclosure_events — no new instrumentation
-- needed.
--
-- Drives the decision in docs/research/clinician-interviews-2026-05.md.
--
-- Usage:
--   1. Run all five queries at the start of the validation window. Record
--      results in the "Pilot metrics snapshot" section of the interview doc.
--   2. Run them again at the end of the window. Note deltas.
--   3. Open-rate thresholds for the decision:
--        - <25%  => strong "deprioritise" signal
--        - 25-50% => mixed (keep as-is, don't deepen)
--        - >=50% => strong "invest more" signal
--      ...combined with the qualitative interviews and admin self-report.
--
-- Safe to run any time — all queries are read-only.

-- ============================================
-- 1. Shares per org per month + open rate
-- ============================================
-- The headline metric. Are facilities actually using this feature? When
-- they do, are the clinicians opening it?
SELECT
  o.name                                                       AS org,
  date_trunc('month', csl.created_at)::date                    AS month,
  count(*)                                                      AS shares_created,
  count(*) FILTER (WHERE csl.first_opened_at IS NOT NULL)       AS shares_opened,
  ROUND(
    100.0 * count(*) FILTER (WHERE csl.first_opened_at IS NOT NULL)
            / NULLIF(count(*), 0),
    1
  )                                                             AS open_pct,
  ROUND(
    EXTRACT(EPOCH FROM percentile_cont(0.5) WITHIN GROUP (
      ORDER BY csl.first_opened_at - csl.created_at
    )) / 3600,
    1
  )                                                             AS median_hours_to_open
FROM clinician_share_links csl
JOIN organizations o ON o.id = csl.organization_id
WHERE csl.created_at > now() - interval '6 months'
GROUP BY o.name, month
ORDER BY month DESC, o.name;

-- ============================================
-- 2. Shares per resident — concentration check
-- ============================================
-- Is the feature broadly used, or concentrated on a handful of residents?
-- High concentration suggests it's reserved for unstable / complex cases
-- (real clinical signal); broad usage suggests routine adoption.
SELECT
  o.name                                       AS org,
  r.first_name || ' ' || r.last_name           AS resident,
  count(*)                                      AS share_count,
  max(csl.created_at)::date                     AS most_recent_share
FROM clinician_share_links csl
JOIN organizations o ON o.id = csl.organization_id
JOIN residents r ON r.id = csl.resident_id
WHERE csl.created_at > now() - interval '6 months'
GROUP BY o.name, resident
HAVING count(*) >= 1
ORDER BY share_count DESC
LIMIT 50;

-- ============================================
-- 3. Engagement over time — first-open vs. repeated reads
-- ============================================
-- Do clinicians come back to the summary, or read once and forget?
-- Repeat opens (open_count > 1) are a stronger value signal than single
-- opens — suggests the content is being referenced clinically.
SELECT
  csl.id,
  o.name                                       AS org,
  csl.created_at::date                          AS created,
  csl.first_opened_at::date                     AS first_opened,
  csl.last_opened_at::date                      AS last_opened,
  csl.open_count,
  csl.revoked_at::date                          AS revoked
FROM clinician_share_links csl
JOIN organizations o ON o.id = csl.organization_id
WHERE csl.created_at > now() - interval '60 days'
ORDER BY csl.created_at DESC;

-- ============================================
-- 4. Per-clinician engagement — which clinicians actually read?
-- ============================================
-- Some clinicians may consistently open; others may never. Tells us
-- whether the feature works for "the right kind of doctor" — useful
-- intel for sales positioning if we proceed.
SELECT
  c.full_name                                  AS clinician,
  c.specialty,
  o.name                                       AS org,
  count(*)                                     AS shares_received,
  count(*) FILTER (WHERE csl.first_opened_at IS NOT NULL) AS shares_opened,
  ROUND(
    100.0 * count(*) FILTER (WHERE csl.first_opened_at IS NOT NULL)
            / NULLIF(count(*), 0),
    1
  )                                            AS open_pct,
  sum(csl.open_count)                          AS total_opens,
  max(csl.last_opened_at)::date                AS last_active
FROM clinician_share_links csl
JOIN clinicians c ON c.id = csl.clinician_id
JOIN organizations o ON o.id = csl.organization_id
WHERE csl.created_at > now() - interval '6 months'
GROUP BY c.full_name, c.specialty, o.name
ORDER BY shares_received DESC, open_pct DESC;

-- ============================================
-- 5. Revocation + expiry — is the feature being actively managed?
-- ============================================
-- Admins revoking shares (e.g., after the visit) signals deliberate use,
-- not "send and forget." Mass-expiry without revoke suggests the share
-- was sent but never followed through.
SELECT
  o.name                                       AS org,
  count(*) FILTER (WHERE csl.revoked_at IS NOT NULL)
                                               AS revoked,
  count(*) FILTER (
    WHERE csl.revoked_at IS NULL
      AND csl.expires_at < now()
      AND csl.first_opened_at IS NULL
  )                                            AS expired_unopened,
  count(*) FILTER (
    WHERE csl.revoked_at IS NULL
      AND csl.expires_at < now()
      AND csl.first_opened_at IS NOT NULL
  )                                            AS expired_after_open,
  count(*) FILTER (
    WHERE csl.revoked_at IS NULL AND csl.expires_at >= now()
  )                                            AS active
FROM clinician_share_links csl
JOIN organizations o ON o.id = csl.organization_id
WHERE csl.created_at > now() - interval '6 months'
GROUP BY o.name
ORDER BY o.name;
