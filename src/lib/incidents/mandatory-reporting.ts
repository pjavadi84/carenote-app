/**
 * Statutory mandatory-reporting classifier for incident reports.
 *
 * Maps an incident's type / severity / AI-flagged signals to whether the
 * facility has a statutory obligation to file a report with the relevant
 * authority within a given window. Output drives:
 *
 *   - Stamps written to incident_reports.mandatory_report_*
 *   - The "X overdue" widget on /incidents
 *   - The reporting-status section on the incident detail page
 *
 * IMPORTANT: this is a TRACKING aid, not legal advice and not a
 * submission system. The classifier errs on the side of flagging more
 * incidents — false positives are cheap (admin reviews, marks "no report
 * needed"), false negatives are expensive (missed statutory deadline).
 *
 * Taiwan rules (regulatory_region = "pdpa_tw"):
 *
 *   Senior Citizens Welfare Act (老人福利法):
 *     §43 — death of resident: report to local social welfare bureau
 *           within 24 hours.
 *     §43-2 — abuse / neglect / suspected abuse: report immediately
 *           (within 24 hours per implementing regulations) to social
 *           welfare bureau.
 *     §41 — missing resident: report to police immediately + social
 *           welfare bureau within 24 hours.
 *
 *   Long-Term Care Services Act (長期照顧服務法):
 *     §44 — service incidents (serious injury, medication errors with
 *           harm, restraint-related injury): report to long-term care
 *           department within 24 hours.
 *
 *   Communicable Disease Control Act (傳染病防治法):
 *     §39 — outbreaks of statutorily designated communicable diseases:
 *           report to CDC immediately (within 24 hours for most
 *           categories, sooner for Class 1).
 *
 * For non-Taiwan orgs, returns required=false. US (state-by-state OBRA
 * reporting), EU (varies by member state), and other regions have their
 * own regimes that aren't modeled here yet.
 */

export type MandatoryReportingAuthority =
  | "social_welfare_bureau"
  | "long_term_care_dept"
  | "police"
  | "cdc"
  | "nhi";

export interface MandatoryReportingClassification {
  required: boolean;
  authority: MandatoryReportingAuthority | null;
  deadlineHours: number | null;
  /** Statute reference frozen on the row for audit reproducibility. */
  legalBasis: string | null;
}

export interface IncidentSignals {
  /** From the AI report's incident_type vocabulary:
   *  fall | near_fall | medication_error | behavioral | injury |
   *  elopement | skin_concern | other */
  incidentType: string;
  /** "low" | "medium" | "high" — from the human classifier's severity. */
  severity: string;
  /** The AI report's notifications_needed.licensing_agency boolean.
   *  When true, the AI itself thinks an authority needs to know. */
  aiFlaggedLicensingAgency?: boolean;
  /** Free-text description from the AI report — used for keyword-based
   *  detection of death / abuse / outbreak signals the type vocabulary
   *  doesn't cover cleanly. */
  description?: string | null;
}

const DEATH_KEYWORDS_EN = [
  "death",
  "deceased",
  "passed away",
  "expired",
  "non-responsive",
  "no pulse",
  "no breathing",
];
const DEATH_KEYWORDS_ZH = ["死亡", "過世", "往生", "離世", "斷氣"];

const ABUSE_KEYWORDS_EN = [
  "abuse",
  "abused",
  "assault",
  "hit",
  "struck",
  "strik", // catches striking / strikes
  "bruise from staff",
  "neglect",
];
const ABUSE_KEYWORDS_ZH = ["虐待", "毆打", "施暴", "疏忽照顧"];

const OUTBREAK_KEYWORDS_EN = [
  "outbreak",
  "covid",
  "tuberculosis",
  "norovirus",
  "scabies",
  "tb-positive",
];
const OUTBREAK_KEYWORDS_ZH = ["群聚", "結核", "諾羅", "疥瘡", "傳染"];

function descriptionMatches(
  description: string | null | undefined,
  needles: string[]
): boolean {
  if (!description) return false;
  const haystack = description.toLowerCase();
  return needles.some((n) => haystack.includes(n.toLowerCase()));
}

function isDeath(s: IncidentSignals): boolean {
  return (
    descriptionMatches(s.description, DEATH_KEYWORDS_EN) ||
    descriptionMatches(s.description, DEATH_KEYWORDS_ZH)
  );
}

function isAbuse(s: IncidentSignals): boolean {
  return (
    s.incidentType === "behavioral" &&
    (descriptionMatches(s.description, ABUSE_KEYWORDS_EN) ||
      descriptionMatches(s.description, ABUSE_KEYWORDS_ZH))
  );
}

function isOutbreak(s: IncidentSignals): boolean {
  return (
    descriptionMatches(s.description, OUTBREAK_KEYWORDS_EN) ||
    descriptionMatches(s.description, OUTBREAK_KEYWORDS_ZH)
  );
}

/**
 * Classify whether an incident triggers Taiwan statutory mandatory
 * reporting. Returns required=false (and no authority) for non-Taiwan
 * orgs — those regimes are out of scope for this PR.
 */
export function classifyMandatoryReporting(
  signals: IncidentSignals,
  regulatoryRegion: string | null | undefined
): MandatoryReportingClassification {
  if (regulatoryRegion !== "pdpa_tw") {
    return { required: false, authority: null, deadlineHours: null, legalBasis: null };
  }

  // Death — highest-priority trigger. Keywords across en + zh-TW.
  if (isDeath(signals)) {
    return {
      required: true,
      authority: "social_welfare_bureau",
      deadlineHours: 24,
      legalBasis: "Senior Citizens Welfare Act §43 (resident death)",
    };
  }

  // Suspected abuse / neglect.
  if (isAbuse(signals)) {
    return {
      required: true,
      authority: "social_welfare_bureau",
      deadlineHours: 24,
      legalBasis: "Senior Citizens Welfare Act §43-2 (suspected abuse)",
    };
  }

  // Missing resident (elopement) — police + social welfare. The slug
  // captures the primary authority; admin notes the secondary in the
  // notes field.
  if (signals.incidentType === "elopement") {
    return {
      required: true,
      authority: "police",
      deadlineHours: 24,
      legalBasis: "Senior Citizens Welfare Act §41 (missing resident)",
    };
  }

  // Communicable disease outbreak.
  if (isOutbreak(signals)) {
    return {
      required: true,
      authority: "cdc",
      deadlineHours: 24,
      legalBasis: "Communicable Disease Control Act §39 (outbreak)",
    };
  }

  // High-severity injury or medication error → LTC services act.
  if (
    signals.severity === "high" &&
    (signals.incidentType === "injury" ||
      signals.incidentType === "fall" ||
      signals.incidentType === "medication_error")
  ) {
    return {
      required: true,
      authority: "long_term_care_dept",
      deadlineHours: 24,
      legalBasis:
        "Long-Term Care Services Act §44 (high-severity service incident)",
    };
  }

  // The AI itself flagged a licensing-agency notification — defer to its
  // judgment, route to social welfare bureau as the most common
  // catch-all authority for elder care. Admin can re-route.
  if (signals.aiFlaggedLicensingAgency) {
    return {
      required: true,
      authority: "social_welfare_bureau",
      deadlineHours: 24,
      legalBasis:
        "AI-flagged for licensing-agency notification (review category)",
    };
  }

  return { required: false, authority: null, deadlineHours: null, legalBasis: null };
}

/**
 * Compute the statutory deadline timestamp from an incident's creation
 * time and the classifier's deadlineHours. Returns null when not
 * required.
 */
export function deadlineAt(
  classification: MandatoryReportingClassification,
  createdAt: Date | string
): string | null {
  if (!classification.required || classification.deadlineHours == null) {
    return null;
  }
  const start =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const deadline = new Date(
    start.getTime() + classification.deadlineHours * 60 * 60 * 1000
  );
  return deadline.toISOString();
}

/**
 * Is a row's mandatory report past its deadline and unsubmitted?
 * Helpers for the dashboard query duplicate this logic in SQL via the
 * idx_incidents_overdue_mandatory_report partial index.
 */
export function isOverdue(row: {
  mandatory_report_required: boolean | null;
  mandatory_report_deadline_at: string | null;
  mandatory_report_submitted_at: string | null;
}): boolean {
  if (!row.mandatory_report_required) return false;
  if (row.mandatory_report_submitted_at) return false;
  if (!row.mandatory_report_deadline_at) return false;
  return new Date(row.mandatory_report_deadline_at) < new Date();
}

/**
 * Human-readable label for the authority slug (for UI rendering).
 */
export function authorityLabel(
  authority: MandatoryReportingAuthority | null
): string {
  switch (authority) {
    case "social_welfare_bureau":
      return "Social Welfare Bureau (社會局/處)";
    case "long_term_care_dept":
      return "Long-Term Care Dept (長照處)";
    case "police":
      return "Police (警察局)";
    case "cdc":
      return "Taiwan CDC (疾管署)";
    case "nhi":
      return "NHI (健保署)";
    case null:
      return "—";
  }
}
