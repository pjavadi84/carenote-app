import { describe, it, expect } from "vitest";
import { buildFamilyUpdateUserPrompt } from "@/lib/prompts/family-update";
import { buildClinicianSummaryUserPrompt } from "@/lib/prompts/clinician-summary";
import { buildWeeklySummaryUserPrompt } from "@/lib/prompts/weekly-summary";
import { buildIncidentReportUserPrompt } from "@/lib/prompts/incident-report";
import type { ResidentLocaleContext } from "@/lib/i18n/locale";

const taiwanLocale: ResidentLocaleContext = {
  preferred_language: "zh-TW",
  output_language: "zh-TW",
  cultural_register: "indirect",
  honorific_preference: "阿嬤",
  family_name: "陳",
  given_name: "雅婷",
  religion: null,
  dietary_restrictions: [],
  country_of_origin: "TW",
  years_in_taiwan: null,
};

const sampleNotes = [
  {
    created_at: "2026-05-08T09:00:00Z",
    author_name: "Maria",
    structured_output: "Ate full breakfast.",
  },
];

describe("cross-language prompt threading", () => {
  describe("family-update", () => {
    it("emits Traditional Chinese instruction when familyLanguage = zh-TW", () => {
      const prompt = buildFamilyUpdateUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        familyContactName: "陳大華",
        relationship: "son",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        notes: sampleNotes,
        familyLanguage: "zh-TW",
      });
      expect(prompt).toContain("Traditional Chinese");
      expect(prompt).toContain("Do not mix languages");
    });

    it("falls back to localeContext.output_language when familyLanguage missing", () => {
      const prompt = buildFamilyUpdateUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        familyContactName: "陳大華",
        relationship: "son",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        notes: sampleNotes,
        localeContext: taiwanLocale,
      });
      expect(prompt).toContain("Traditional Chinese");
    });

    it("emits no language instruction for English defaults", () => {
      const prompt = buildFamilyUpdateUserPrompt({
        facilityName: "Sunrise",
        residentFirstName: "Eleanor",
        residentLastName: "Hughes",
        familyContactName: "Mark Hughes",
        relationship: "son",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        notes: sampleNotes,
        familyLanguage: "en",
      });
      expect(prompt).not.toContain("Output language");
    });

    it("familyLanguage takes precedence over localeContext.output_language", () => {
      // Resident is zh-TW but contact prefers Vietnamese — contact wins.
      const prompt = buildFamilyUpdateUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        familyContactName: "Mai",
        relationship: "daughter-in-law",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        notes: sampleNotes,
        localeContext: taiwanLocale,
        familyLanguage: "vi",
      });
      expect(prompt).toContain("Vietnamese");
      expect(prompt).not.toContain("Traditional Chinese");
    });
  });

  describe("clinician-summary", () => {
    it("emits Traditional Chinese when clinicalLanguage = zh-TW", () => {
      const prompt = buildClinicianSummaryUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        residentDob: null,
        clinicianName: "Dr. Lin",
        relationship: "PCP",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        conditions: null,
        careNotesContext: null,
        notes: sampleNotes,
        clinicalLanguage: "zh-TW",
      });
      expect(prompt).toContain("Traditional Chinese");
    });

    it("clinicalLanguage takes precedence over localeContext.output_language", () => {
      // Resident is zh-TW but clinician prefers English (e.g., specialist).
      const prompt = buildClinicianSummaryUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        residentDob: null,
        clinicianName: "Dr. Smith",
        relationship: "specialist",
        dateRangeStart: "2026-05-01",
        dateRangeEnd: "2026-05-08",
        conditions: null,
        careNotesContext: null,
        notes: sampleNotes,
        localeContext: taiwanLocale,
        clinicalLanguage: "en",
      });
      expect(prompt).not.toContain("Output language");
    });
  });

  describe("weekly-summary", () => {
    it("emits Traditional Chinese when localeContext is Taiwan", () => {
      const prompt = buildWeeklySummaryUserPrompt({
        facilityName: "心安",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        conditions: null,
        careNotesContext: null,
        weekStart: "2026-05-04",
        weekEnd: "2026-05-10",
        notes: [
          {
            ...sampleNotes[0],
            shift: "morning",
          },
        ],
        localeContext: taiwanLocale,
      });
      expect(prompt).toContain("Traditional Chinese");
    });

    it("falls back to English when no locale provided", () => {
      const prompt = buildWeeklySummaryUserPrompt({
        facilityName: "Sunrise",
        residentFirstName: "Eleanor",
        residentLastName: "Hughes",
        conditions: null,
        careNotesContext: null,
        weekStart: "2026-05-04",
        weekEnd: "2026-05-10",
        notes: [
          {
            ...sampleNotes[0],
            shift: "morning",
          },
        ],
      });
      expect(prompt).not.toContain("Output language");
    });
  });

  describe("incident-report", () => {
    it("emits Traditional Chinese when localeContext is Taiwan", () => {
      const prompt = buildIncidentReportUserPrompt({
        residentFirstName: "雅婷",
        residentLastName: "陳",
        conditions: null,
        timestamp: "2026-05-08T09:00:00Z",
        caregiverName: "Maria",
        rawInput: "Resident slipped near bathroom.",
        localeContext: taiwanLocale,
      });
      expect(prompt).toContain("Traditional Chinese");
    });
  });
});
