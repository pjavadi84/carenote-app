import { describe, it, expect } from "vitest";
import {
  applyScope,
  EXPORT_DAILY_LIMIT,
  keysForScope,
  policyForRecipient,
  rateLimitDecision,
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
