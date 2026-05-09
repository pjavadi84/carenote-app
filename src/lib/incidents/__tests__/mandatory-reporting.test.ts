import { describe, it, expect } from "vitest";
import {
  authorityLabel,
  classifyMandatoryReporting,
  deadlineAt,
  isOverdue,
} from "@/lib/incidents/mandatory-reporting";

describe("classifyMandatoryReporting", () => {
  it("returns required=false for non-Taiwan orgs regardless of severity", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "fall",
        severity: "high",
        aiFlaggedLicensingAgency: true,
        description: "Resident died after fall.",
      },
      "hipaa_us"
    );
    expect(out.required).toBe(false);
    expect(out.authority).toBeNull();
  });

  it("flags death (English keyword) → social welfare bureau, 24h, §43", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "fall",
        severity: "high",
        description: "Resident found non-responsive at 06:00. Death confirmed at 06:15.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("social_welfare_bureau");
    expect(out.deadlineHours).toBe(24);
    expect(out.legalBasis).toMatch(/§43/);
  });

  it("flags death (zh-TW keyword)", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "other",
        severity: "high",
        description: "陳奶奶今晨過世。",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("social_welfare_bureau");
  });

  it("flags suspected abuse (behavioral + abuse keywords) → §43-2", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "behavioral",
        severity: "medium",
        description: "Caregiver was witnessed striking the resident.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("social_welfare_bureau");
    expect(out.legalBasis).toMatch(/§43-2/);
  });

  it("does NOT flag behavioral without abuse keywords", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "behavioral",
        severity: "low",
        description: "Resident agitated during morning care, calmed after redirection.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(false);
  });

  it("flags elopement → police, §41", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "elopement",
        severity: "medium",
        description: "Resident left the building unobserved.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("police");
    expect(out.legalBasis).toMatch(/§41/);
  });

  it("flags outbreak (English keyword) → CDC", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "other",
        severity: "high",
        description: "Three residents on floor 2 tested positive for tuberculosis.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("cdc");
  });

  it("flags outbreak (zh-TW keyword 群聚)", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "other",
        severity: "medium",
        description: "二樓住民出現群聚感染症狀。",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("cdc");
  });

  it("flags high-severity fall / injury / medication_error → LTC dept", () => {
    for (const incidentType of ["fall", "injury", "medication_error"]) {
      const out = classifyMandatoryReporting(
        {
          incidentType,
          severity: "high",
          description: "Resident hospitalized after the incident.",
        },
        "pdpa_tw"
      );
      expect(out.required, incidentType).toBe(true);
      expect(out.authority).toBe("long_term_care_dept");
    }
  });

  it("does NOT flag low/medium injury or fall without other signals", () => {
    expect(
      classifyMandatoryReporting(
        {
          incidentType: "fall",
          severity: "low",
          description: "Slipped, no injury observed.",
        },
        "pdpa_tw"
      ).required
    ).toBe(false);
    expect(
      classifyMandatoryReporting(
        {
          incidentType: "injury",
          severity: "medium",
          description: "Bruise on forearm, no skin break.",
        },
        "pdpa_tw"
      ).required
    ).toBe(false);
  });

  it("falls back on AI's licensing-agency flag → social welfare bureau", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "skin_concern",
        severity: "medium",
        aiFlaggedLicensingAgency: true,
        description: "Stage 3 pressure ulcer noted on sacrum.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(true);
    expect(out.authority).toBe("social_welfare_bureau");
  });

  it("returns not-required when no signals match", () => {
    const out = classifyMandatoryReporting(
      {
        incidentType: "near_fall",
        severity: "low",
        description: "Used grab bar, recovered without falling.",
      },
      "pdpa_tw"
    );
    expect(out.required).toBe(false);
  });
});

describe("deadlineAt", () => {
  it("returns ISO 24h after createdAt for required reports", () => {
    const out = deadlineAt(
      {
        required: true,
        authority: "social_welfare_bureau",
        deadlineHours: 24,
        legalBasis: "test",
      },
      "2026-05-09T08:00:00Z"
    );
    expect(out).toBe("2026-05-10T08:00:00.000Z");
  });

  it("returns null when not required", () => {
    expect(
      deadlineAt(
        { required: false, authority: null, deadlineHours: null, legalBasis: null },
        "2026-05-09T08:00:00Z"
      )
    ).toBeNull();
  });
});

describe("isOverdue", () => {
  it("true when required + past deadline + unsubmitted", () => {
    expect(
      isOverdue({
        mandatory_report_required: true,
        mandatory_report_deadline_at: "2020-01-01T00:00:00Z",
        mandatory_report_submitted_at: null,
      })
    ).toBe(true);
  });

  it("false when submitted (regardless of deadline)", () => {
    expect(
      isOverdue({
        mandatory_report_required: true,
        mandatory_report_deadline_at: "2020-01-01T00:00:00Z",
        mandatory_report_submitted_at: "2020-01-02T00:00:00Z",
      })
    ).toBe(false);
  });

  it("false when not required", () => {
    expect(
      isOverdue({
        mandatory_report_required: false,
        mandatory_report_deadline_at: null,
        mandatory_report_submitted_at: null,
      })
    ).toBe(false);
  });

  it("false when deadline still in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      isOverdue({
        mandatory_report_required: true,
        mandatory_report_deadline_at: future,
        mandatory_report_submitted_at: null,
      })
    ).toBe(false);
  });
});

describe("authorityLabel", () => {
  it("renders bilingual labels for each Taiwan authority", () => {
    expect(authorityLabel("social_welfare_bureau")).toMatch(/社會/);
    expect(authorityLabel("long_term_care_dept")).toMatch(/長照/);
    expect(authorityLabel("police")).toMatch(/警察/);
    expect(authorityLabel("cdc")).toMatch(/疾管/);
    expect(authorityLabel(null)).toBe("—");
  });
});
