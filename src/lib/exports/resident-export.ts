/**
 * F4 #3 — role-based PHI export controls.
 *
 * Centralizes the policy decisions for /api/residents/[id]/export so
 * the route stays focused on glue + persistence:
 *
 *   - Recipient + legal-basis vocabulary (must match disclosure_events
 *     CHECK constraints in 00024).
 *   - Bundle-scope filtering (full / clinical_only / demographics_only).
 *   - Daily-volume rate limit per org.
 *   - Reason validation.
 *
 * Pure functions; the route owns the supabase / audit calls.
 */

export type ExportRecipientType =
  | "patient_or_guardian"
  | "other_facility"
  | "regulator"
  | "legal_request"
  | "agency_internal";

export type ExportScope = "full" | "clinical_only" | "demographics_only";

export interface ExportRequestParams {
  reason: string;
  recipientType: ExportRecipientType;
  scope: ExportScope;
  recipientName?: string | null;
}

export interface ExportPolicyDecision {
  /** disclosure_events.recipient_type. */
  disclosureRecipientType: string;
  /** disclosure_events.legal_basis. */
  disclosureLegalBasis: string;
}

/**
 * Map an export's declared recipientType → the (recipient_type,
 * legal_basis) pair used to log the disclosure. Each combination
 * encodes the lawful basis under HIPAA / PDPA for the data leaving
 * the system.
 */
export function policyForRecipient(
  recipientType: ExportRecipientType
): ExportPolicyDecision {
  switch (recipientType) {
    case "patient_or_guardian":
      // Data portability request from the resident themselves or their
      // guardian. PDPA Art. 10; HIPAA right of access.
      return {
        disclosureRecipientType: "patient_or_guardian",
        disclosureLegalBasis: "patient_request",
      };
    case "other_facility":
      // Continuity of care — chart following the resident to a new
      // residential or acute facility. HIPAA TPO §164.506(c)(4).
      return {
        disclosureRecipientType: "other_facility",
        disclosureLegalBasis: "continuity_of_care",
      };
    case "regulator":
      // Regulator audit / inspection. PDPA Art. 22; HIPAA §164.512(d).
      return {
        disclosureRecipientType: "regulator",
        disclosureLegalBasis: "regulatory_request",
      };
    case "legal_request":
      // Subpoena, court order, attorney request. HIPAA §164.512(e).
      return {
        disclosureRecipientType: "legal_request",
        disclosureLegalBasis: "subpoena_or_court_order",
      };
    case "agency_internal":
      // Internal backup / audit / training. HIPAA TPO operations.
      return {
        disclosureRecipientType: "agency_internal",
        disclosureLegalBasis: "operations",
      };
  }
}

const MIN_REASON_LENGTH = 10;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Lightweight server-side request validator. UI also validates client-
 * side; this is the authoritative check.
 */
export function validateExportRequest(
  body: Partial<ExportRequestParams> | null | undefined
): ValidationResult {
  if (!body) return { ok: false, error: "Body required" };
  if (!body.reason || body.reason.trim().length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: `Reason must be at least ${MIN_REASON_LENGTH} characters`,
    };
  }
  if (
    !body.recipientType ||
    ![
      "patient_or_guardian",
      "other_facility",
      "regulator",
      "legal_request",
      "agency_internal",
    ].includes(body.recipientType)
  ) {
    return { ok: false, error: "Invalid recipientType" };
  }
  if (
    !body.scope ||
    !["full", "clinical_only", "demographics_only"].includes(body.scope)
  ) {
    return { ok: false, error: "Invalid scope" };
  }
  return { ok: true };
}

/**
 * The export bundle's top-level keys, grouped by what each scope
 * includes. Used to filter the raw bundle and to record exactly what
 * was shared in disclosure_events.categories_shared.
 */
const SCOPE_KEYS: Record<ExportScope, string[]> = {
  full: [
    "resident",
    "family_contacts",
    "treating_clinicians",
    "notes",
    "incident_reports",
    "weekly_summaries",
    "family_communications",
    "disclosure_events",
    "audit_events",
    "voice_sessions",
    "voice_transcripts",
  ],
  clinical_only: [
    "resident",
    "treating_clinicians",
    "notes",
    "incident_reports",
    "weekly_summaries",
    "voice_sessions",
    "voice_transcripts",
  ],
  demographics_only: ["resident", "family_contacts"],
};

/** What top-level keys SHOULD be in the bundle for the given scope. */
export function keysForScope(scope: ExportScope): string[] {
  return SCOPE_KEYS[scope];
}

/**
 * Filter a fully-loaded export bundle down to the keys the scope
 * permits. The route loads everything once (RLS-scoped) and this fn
 * decides what gets serialized into the response. Cheap to do in
 * memory because all rows are already in scope.
 */
export function applyScope<T extends Record<string, unknown>>(
  bundle: T,
  scope: ExportScope
): Partial<T> {
  const keep = new Set(keysForScope(scope));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(bundle)) {
    if (keep.has(k)) {
      out[k] = bundle[k];
    }
  }
  return out as Partial<T>;
}

export const EXPORT_DAILY_LIMIT = 10;

/**
 * Decide whether an export should be rate-limited. Inputs are the
 * count of completed exports in the last 24h for this org. Returns
 * { allowed, remaining }; the route turns !allowed into 429.
 */
export function rateLimitDecision(recentExportCount: number): {
  allowed: boolean;
  remaining: number;
} {
  const remaining = Math.max(0, EXPORT_DAILY_LIMIT - recentExportCount);
  return { allowed: remaining > 0, remaining };
}
