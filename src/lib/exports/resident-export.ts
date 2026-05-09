/**
 * F4 #3 — role-based PHI export controls.
 *
 * Centralizes the policy decisions for /api/residents/[id]/export so
 * the route stays focused on glue + persistence:
 *
 *   - Recipient + legal-basis vocabulary (must match disclosure_events
 *     CHECK constraints in 00024).
 *   - Bundle-scope filtering (full / clinical_only / demographics_only).
 *   - Optional identifier redaction (PHI-safe export) for recipients
 *     who don't need direct identifiers — composes the F4 #4 redactor.
 *   - Daily-volume rate limit per org.
 *   - Reason validation.
 *
 * Pure functions; the route owns the supabase / audit calls.
 */

import {
  redactPhi,
  redactPhiText,
  yearToBand,
  type RedactionStats,
} from "@/lib/redaction";

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
  /**
   * When true, the bundle is piped through redactBundle() before
   * serialization. Identifiers (ROC ID, NHI, CCCD, NIK, SSN, postal
   * addresses) are stripped from text fields and full DOBs are
   * replaced with a 5-year band. Clinical content is preserved.
   */
  redactIdentifiers?: boolean;
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
  if (
    body.redactIdentifiers !== undefined &&
    typeof body.redactIdentifiers !== "boolean"
  ) {
    return { ok: false, error: "redactIdentifiers must be boolean" };
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

// ============================================
// Bundle-level identifier redaction (PHI-safe export)
// ============================================

/**
 * Per-table list of column names whose string values must flow through
 * redactPhi() when the caller asks for a redacted export. Driven by
 * schema, not heuristics — every column that can hold free-text PHI
 * is enumerated here so a future column add doesn't silently leak.
 *
 * Resident is handled separately because some of its columns are typed
 * dates (date_of_birth, lunar_calendar_dob) that the regex layer
 * doesn't see — those are coerced to a 5-year band explicitly.
 */
const TEXT_FIELDS_BY_TABLE: Record<string, readonly string[]> = {
  notes: ["raw_input", "structured_output", "edited_output", "structuring_error"],
  incident_reports: ["report_text", "manager_notes"],
  family_communications: ["subject", "body", "disclosure_footer"],
  voice_transcripts: ["text"],
};

/**
 * Resident-row columns that hold free-text PHI. Names (first_name,
 * last_name, family_name, given_name, name_pronunciation) are PRESERVED
 * — the recipient legitimately needs to address the resident, and
 * they're already on the disclosure-event row.
 */
const RESIDENT_TEXT_FIELDS = [
  "conditions",
  "preferences",
  "care_notes_context",
] as const;

/**
 * Resident-row columns that are typed DATEs holding identifying
 * information. Postgres returns these as ISO date strings; we convert
 * to a 5-year band string so the recipient sees an age range without
 * a uniquely-identifying date.
 */
const RESIDENT_DATE_FIELDS = ["date_of_birth", "lunar_calendar_dob"] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeStats(a: RedactionStats, b: RedactionStats): RedactionStats {
  return {
    rocId: a.rocId + b.rocId,
    id12: a.id12 + b.id12,
    nik: a.nik + b.nik,
    dob: a.dob + b.dob,
    address: a.address + b.address,
    ssn: a.ssn + b.ssn,
  };
}

function emptyStats(): RedactionStats {
  return { rocId: 0, id12: 0, nik: 0, dob: 0, address: 0, ssn: 0 };
}

/**
 * Run redactPhi over a string-or-JSON-string value. Accepts a non-string
 * value unchanged. For JSON-encoded text fields (e.g. notes.structured_output)
 * the surrounding JSON syntax is preserved because redactPhi only matches
 * identifier patterns, not braces or quotes.
 */
function redactString(value: unknown, stats: { v: RedactionStats }): unknown {
  if (typeof value !== "string" || value.length === 0) return value;
  const result = redactPhi(value);
  stats.v = mergeStats(stats.v, result.stats);
  return result.text;
}

function redactRow(
  row: Record<string, unknown>,
  fields: readonly string[],
  stats: { v: RedactionStats }
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const f of fields) {
    if (f in out) out[f] = redactString(out[f], stats);
  }
  return out;
}

/**
 * Convert an ISO date ("YYYY-MM-DD") to a 5-year band string. Anything
 * that isn't an ISO date passes through unchanged — the redactPhi regex
 * layer handles free-text DOBs separately.
 */
function dateToBand(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const m = value.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!m) return value;
  return yearToBand(m[1]);
}

function redactResidentRow(
  resident: Record<string, unknown>,
  stats: { v: RedactionStats }
): Record<string, unknown> {
  const out = redactRow(resident, RESIDENT_TEXT_FIELDS, stats);
  for (const f of RESIDENT_DATE_FIELDS) {
    if (f in out && out[f] !== null && out[f] !== undefined) {
      const before = out[f];
      const after = dateToBand(before);
      if (after !== before) {
        out[f] = after;
        stats.v.dob += 1;
      }
    }
  }
  return out;
}

/**
 * Walk a string-keyed JSONB tree (e.g. notes.metadata) and redact every
 * string leaf. Defensive — metadata shouldn't carry identifier-rich
 * content, but it's free-form so we don't trust it.
 */
function redactJsonValue(value: unknown, stats: { v: RedactionStats }): unknown {
  if (typeof value === "string") {
    return redactPhiText(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactJsonValue(v, stats));
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactJsonValue(v, stats);
    }
    return out;
  }
  return value;
}

export interface RedactBundleResult<T> {
  bundle: T;
  stats: RedactionStats;
}

/**
 * Strip identifiers from a fully-loaded export bundle. Operates on the
 * post-applyScope() bundle so a `demographics_only` redacted export
 * still contains only the keys the scope permits.
 *
 * Strategy:
 *   - resident row: redact free-text columns, replace DOB columns with
 *     a 5-year band.
 *   - notes / incident_reports / family_communications / voice_transcripts:
 *     redact the columns enumerated in TEXT_FIELDS_BY_TABLE on every row.
 *   - notes.metadata + weekly_summaries.metadata + weekly_summaries.key_trends
 *     + weekly_summaries.concerns: walked and redacted (defensive).
 *   - family_contacts / treating_clinicians / disclosure_events / audit_events:
 *     left as-is. They describe the disclosure or the recipient, not the
 *     subject's PHI — stripping recipient identifiers from the audit trail
 *     would defeat the audit's purpose. weekly_summaries.summary_text and
 *     friends are clinical text and DO get redacted via the TEXT_FIELDS path.
 */
export function redactBundle<T extends Record<string, unknown>>(
  bundle: T
): RedactBundleResult<T> {
  const stats = { v: emptyStats() };
  const out: Record<string, unknown> = { ...bundle };

  if (isObject(out.resident)) {
    out.resident = redactResidentRow(
      out.resident as Record<string, unknown>,
      stats
    );
  }

  for (const [table, fields] of Object.entries(TEXT_FIELDS_BY_TABLE)) {
    const rows = out[table];
    if (Array.isArray(rows)) {
      out[table] = rows.map((row) =>
        isObject(row) ? redactRow(row, fields, stats) : row
      );
    }
  }

  // notes.metadata is JSONB — walk it.
  if (Array.isArray(out.notes)) {
    out.notes = (out.notes as Array<Record<string, unknown>>).map((n) => {
      if (!isObject(n) || !("metadata" in n)) return n;
      return { ...n, metadata: redactJsonValue(n.metadata, stats) };
    });
  }

  // weekly_summaries: summary_text + key_trends/concerns arrays + metadata.
  if (Array.isArray(out.weekly_summaries)) {
    out.weekly_summaries = (
      out.weekly_summaries as Array<Record<string, unknown>>
    ).map((w) => {
      if (!isObject(w)) return w;
      const next: Record<string, unknown> = { ...w };
      if (typeof next.summary_text === "string") {
        next.summary_text = redactString(next.summary_text, stats);
      }
      if (Array.isArray(next.key_trends)) {
        next.key_trends = (next.key_trends as unknown[]).map((s) =>
          redactString(s, stats)
        );
      }
      if (Array.isArray(next.concerns)) {
        next.concerns = (next.concerns as unknown[]).map((s) =>
          redactString(s, stats)
        );
      }
      if ("metadata" in next) {
        next.metadata = redactJsonValue(next.metadata, stats);
      }
      return next;
    });
  }

  return { bundle: out as T, stats: stats.v };
}
