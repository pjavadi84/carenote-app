import { describe, it, expect } from "vitest";
import {
  applyScope,
  EXPORT_DAILY_LIMIT,
  keysForScope,
  policyForRecipient,
  rateLimitDecision,
  redactBundle,
  validateExportRequest,
} from "@/lib/exports/resident-export";

describe("policyForRecipient", () => {
  it("maps patient_or_guardian → patient_request basis", () => {
    expect(policyForRecipient("patient_or_guardian")).toEqual({
      disclosureRecipientType: "patient_or_guardian",
      disclosureLegalBasis: "patient_request",
    });
  });

  it("maps other_facility → continuity_of_care", () => {
    expect(policyForRecipient("other_facility").disclosureLegalBasis).toBe(
      "continuity_of_care"
    );
  });

  it("maps regulator → regulatory_request", () => {
    expect(policyForRecipient("regulator").disclosureLegalBasis).toBe(
      "regulatory_request"
    );
  });

  it("maps legal_request → subpoena_or_court_order", () => {
    expect(policyForRecipient("legal_request").disclosureLegalBasis).toBe(
      "subpoena_or_court_order"
    );
  });

  it("maps agency_internal → operations (legacy basis preserved)", () => {
    expect(policyForRecipient("agency_internal").disclosureLegalBasis).toBe(
      "operations"
    );
  });
});

describe("validateExportRequest", () => {
  it("rejects null / missing body", () => {
    expect(validateExportRequest(null).ok).toBe(false);
    expect(validateExportRequest(undefined).ok).toBe(false);
  });

  it("rejects short reason (< 10 chars)", () => {
    const v = validateExportRequest({
      reason: "too short",
      recipientType: "agency_internal",
      scope: "full",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/10/);
  });

  it("rejects unknown recipientType", () => {
    const v = validateExportRequest({
      reason: "valid reason here",
      // @ts-expect-error testing invalid input
      recipientType: "bogus",
      scope: "full",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/recipientType/);
  });

  it("rejects unknown scope", () => {
    const v = validateExportRequest({
      reason: "valid reason here",
      recipientType: "agency_internal",
      // @ts-expect-error testing invalid input
      scope: "everything_plus_secret_logs",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/scope/);
  });

  it("accepts a fully-formed request", () => {
    expect(
      validateExportRequest({
        reason: "Family requested portability",
        recipientType: "patient_or_guardian",
        scope: "full",
      })
    ).toEqual({ ok: true });
  });

  it("accepts redactIdentifiers true / false / undefined", () => {
    for (const v of [true, false, undefined]) {
      expect(
        validateExportRequest({
          reason: "Family requested portability",
          recipientType: "patient_or_guardian",
          scope: "full",
          redactIdentifiers: v,
        }).ok
      ).toBe(true);
    }
  });

  it("rejects non-boolean redactIdentifiers", () => {
    const v = validateExportRequest({
      reason: "Family requested portability",
      recipientType: "patient_or_guardian",
      scope: "full",
      // @ts-expect-error testing invalid input
      redactIdentifiers: "yes",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/redactIdentifiers/);
  });
});

describe("keysForScope + applyScope", () => {
  const fullBundle = {
    resident: { id: "r-1", first_name: "Eleanor" },
    family_contacts: [{ name: "Sarah" }],
    treating_clinicians: [{ id: "c-1" }],
    notes: [{ id: "n-1" }],
    incident_reports: [{ id: "i-1" }],
    weekly_summaries: [{ id: "w-1" }],
    family_communications: [{ id: "fc-1" }],
    disclosure_events: [{ id: "d-1" }],
    audit_events: [{ id: "a-1" }],
    voice_sessions: [{ id: "v-1" }],
    voice_transcripts: [{ id: "vt-1" }],
  };

  it("full keeps every top-level key", () => {
    const out = applyScope(fullBundle, "full");
    expect(Object.keys(out).sort()).toEqual(Object.keys(fullBundle).sort());
  });

  it("clinical_only drops family_contacts, family_communications, disclosure_events, audit_events", () => {
    const out = applyScope(fullBundle, "clinical_only");
    expect(out.notes).toBeDefined();
    expect(out.incident_reports).toBeDefined();
    expect(out.weekly_summaries).toBeDefined();
    expect(out.voice_sessions).toBeDefined();
    expect(out.voice_transcripts).toBeDefined();
    expect(out.family_contacts).toBeUndefined();
    expect(out.family_communications).toBeUndefined();
    expect(out.disclosure_events).toBeUndefined();
    expect(out.audit_events).toBeUndefined();
  });

  it("demographics_only keeps resident + family_contacts only", () => {
    const out = applyScope(fullBundle, "demographics_only");
    expect(Object.keys(out).sort()).toEqual(["family_contacts", "resident"]);
  });

  it("keysForScope is consistent with applyScope output", () => {
    for (const scope of ["full", "clinical_only", "demographics_only"] as const) {
      const declared = keysForScope(scope);
      const out = applyScope(fullBundle, scope);
      expect(Object.keys(out).sort()).toEqual([...declared].sort());
    }
  });
});

describe("rateLimitDecision", () => {
  it("allows when under the daily limit", () => {
    expect(rateLimitDecision(0)).toEqual({
      allowed: true,
      remaining: EXPORT_DAILY_LIMIT,
    });
    expect(rateLimitDecision(EXPORT_DAILY_LIMIT - 1).allowed).toBe(true);
  });

  it("blocks at and above the daily limit", () => {
    expect(rateLimitDecision(EXPORT_DAILY_LIMIT)).toEqual({
      allowed: false,
      remaining: 0,
    });
    expect(rateLimitDecision(EXPORT_DAILY_LIMIT + 5)).toEqual({
      allowed: false,
      remaining: 0,
    });
  });
});

describe("redactBundle", () => {
  it("strips identifiers from notes.raw_input but preserves clinical content", () => {
    const bundle = {
      resident: {
        id: "r-1",
        first_name: "Eleanor",
        last_name: "Hsu",
        date_of_birth: "1942-03-22",
        conditions: "Mild dementia",
      },
      notes: [
        {
          id: "n-1",
          raw_input:
            "Eleanor's ID is A123456789. She fell at 14:30 near the bathroom.",
          structured_output: null,
          metadata: { categories: ["safety_alerts"] },
        },
      ],
    };

    const { bundle: out, stats } = redactBundle(bundle);

    const note = (out.notes as Array<{ raw_input: string }>)[0];
    expect(note.raw_input).toContain("[ROC_ID_REDACTED]");
    expect(note.raw_input).toContain("Eleanor"); // given name preserved
    expect(note.raw_input).toContain("fell at 14:30"); // clinical fact preserved
    expect(note.raw_input).toContain("bathroom");
    expect(stats.rocId).toBe(1);
  });

  it("converts resident.date_of_birth from ISO date to a 5-year band", () => {
    const { bundle: out, stats } = redactBundle({
      resident: { id: "r-1", date_of_birth: "1942-03-22" },
    });
    expect((out.resident as { date_of_birth: string }).date_of_birth).toMatch(
      /1940s/
    );
    expect(stats.dob).toBeGreaterThanOrEqual(1);
  });

  it("converts resident.lunar_calendar_dob if present", () => {
    const { bundle: out } = redactBundle({
      resident: { id: "r-1", lunar_calendar_dob: "1985-07-15" },
    });
    expect(
      (out.resident as { lunar_calendar_dob: string }).lunar_calendar_dob
    ).toMatch(/1980s/);
  });

  it("leaves null DOB columns alone", () => {
    const { bundle: out } = redactBundle({
      resident: { id: "r-1", date_of_birth: null, lunar_calendar_dob: null },
    });
    expect((out.resident as { date_of_birth: null }).date_of_birth).toBeNull();
  });

  it("redacts incident_reports.report_text", () => {
    const { bundle: out, stats } = redactBundle({
      incident_reports: [
        {
          id: "i-1",
          report_text:
            "Resident's NHI A187654321 — fall in dining room at 2026-03-15.",
        },
      ],
    });
    const ir = (out.incident_reports as Array<{ report_text: string }>)[0];
    expect(ir.report_text).toContain("[ROC_ID_REDACTED]");
    // Note: 2026-03-15 is an ISO date that the dob regex catches; it gets
    // banded. That's acceptable — it's not a clinical fact, just timing
    // metadata, and over-redaction is the design choice for this layer.
    expect(stats.rocId).toBe(1);
  });

  it("redacts weekly_summaries summary_text + key_trends + concerns", () => {
    const { bundle: out } = redactBundle({
      weekly_summaries: [
        {
          id: "w-1",
          summary_text:
            "Mostly stable. ROC ID A123456789 referenced in chart.",
          key_trends: ["Sleep improving", "Visited 100 Forbes Ave"],
          concerns: [],
        },
      ],
    });
    const w = (
      out.weekly_summaries as Array<{
        summary_text: string;
        key_trends: string[];
      }>
    )[0];
    expect(w.summary_text).toContain("[ROC_ID_REDACTED]");
    expect(w.key_trends[1]).toContain("[ADDRESS_REDACTED]");
    expect(w.key_trends[0]).toBe("Sleep improving");
  });

  it("redacts voice_transcripts.text", () => {
    const { bundle: out } = redactBundle({
      voice_transcripts: [
        { id: "vt-1", text: "Caregiver said the address is 100 Forbes Ave." },
      ],
    });
    const t = (out.voice_transcripts as Array<{ text: string }>)[0];
    expect(t.text).toContain("[ADDRESS_REDACTED]");
  });

  it("leaves family_contacts and disclosure_events untouched", () => {
    const bundle = {
      family_contacts: [
        { id: "fc-1", name: "Sarah Hsu", email: "sarah@example.com" },
      ],
      disclosure_events: [
        {
          id: "d-1",
          recipient_type: "family_contact",
          legal_basis: "patient_agreement",
        },
      ],
    };
    const { bundle: out } = redactBundle(bundle);
    expect(out.family_contacts).toEqual(bundle.family_contacts);
    expect(out.disclosure_events).toEqual(bundle.disclosure_events);
  });

  it("returns aggregate stats summed across all rows", () => {
    const { stats } = redactBundle({
      notes: [
        { id: "n-1", raw_input: "ID A111111111 noted." },
        { id: "n-2", raw_input: "ID A222222222 also." },
      ],
      voice_transcripts: [
        { id: "vt-1", text: "Lives at 100 Forbes Ave." },
      ],
    });
    expect(stats.rocId).toBe(2);
    expect(stats.address).toBe(1);
  });

  it("preserves bundles with no redactable content (zero stats)", () => {
    const bundle = {
      resident: { id: "r-1", first_name: "Eleanor", conditions: null },
      notes: [{ id: "n-1", raw_input: "Calm morning, ate breakfast." }],
    };
    const { bundle: out, stats } = redactBundle(bundle);
    expect(out).toEqual(bundle);
    expect(stats).toEqual({
      rocId: 0,
      id12: 0,
      nik: 0,
      dob: 0,
      address: 0,
      ssn: 0,
    });
  });
});
