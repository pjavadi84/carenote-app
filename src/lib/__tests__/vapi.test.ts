import { describe, it, expect } from "vitest";
import { buildAssistantOverrides } from "@/lib/vapi";

describe("vapi", () => {
  describe("buildAssistantOverrides", () => {
    it("builds overrides with all multilingual + grounding fields", () => {
      const result = buildAssistantOverrides({
        caregiverName: "Maria Santos",
        caregiverLanguage: "en",
        residentFirstName: "Eleanor",
        residentLastName: "Hughes",
        residentLanguage: "en",
        outputLanguage: "en",
        honorificPreference: "Mrs.",
        culturalRegister: "direct",
        conditions: "Mild dementia, hypertension",
        careNotesContext: "Prefers morning walks",
        recentNotesSummary: "5/1: ate full meal. 4/30: walked 15 min.",
        recentIncidents: "",
      });

      expect(result.variableValues).toEqual({
        caregiver_name: "Maria Santos",
        caregiver_language: "en",
        resident_first_name: "Eleanor",
        resident_last_name: "Hughes",
        resident_language: "en",
        output_language: "en",
        honorific_preference: "Mrs.",
        cultural_register: "direct",
        conditions: "Mild dementia, hypertension",
        care_context: "Prefers morning walks",
        recent_notes_summary: "5/1: ate full meal. 4/30: walked 15 min.",
        recent_incidents: "no recent incidents",
      });
    });

    it("defaults null conditions, context, and empty grounding", () => {
      const result = buildAssistantOverrides({
        caregiverName: "Mai",
        caregiverLanguage: "vi",
        residentFirstName: "Hương",
        residentLastName: "Nguyễn",
        residentLanguage: "vi",
        outputLanguage: "zh-TW",
        honorificPreference: "Bác",
        culturalRegister: "indirect",
        conditions: null,
        careNotesContext: null,
        recentNotesSummary: "",
        recentIncidents: "",
      });

      expect(result.variableValues.conditions).toBe("none on file");
      expect(result.variableValues.care_context).toBe("none on file");
      expect(result.variableValues.recent_notes_summary).toBe("no recent notes");
      expect(result.variableValues.recent_incidents).toBe("no recent incidents");
      expect(result.variableValues.cultural_register).toBe("indirect");
      expect(result.transcriber).toBeUndefined();
    });

    it("attaches per-call keyterms when provided", () => {
      const result = buildAssistantOverrides({
        caregiverName: "Mai",
        caregiverLanguage: "vi",
        residentFirstName: "雅婷",
        residentLastName: "陳",
        residentLanguage: "zh-TW",
        outputLanguage: "zh-TW",
        honorificPreference: "阿嬤",
        culturalRegister: "indirect",
        conditions: "type 2 diabetes",
        careNotesContext: null,
        recentNotesSummary: "",
        recentIncidents: "",
        keyterms: ["雅婷", "metformin", "  ", ""],
      });

      expect(result.transcriber?.provider).toBe("deepgram");
      expect(result.transcriber?.keyterm).toEqual(["雅婷", "metformin"]);
    });

    it("redacts PHI from caregiver-authored fields before they leave for Vapi", () => {
      const result = buildAssistantOverrides({
        caregiverName: "Maria Santos",
        caregiverLanguage: "en",
        residentFirstName: "陳奶奶",
        residentLastName: "陳",
        residentLanguage: "zh-TW",
        outputLanguage: "zh-TW",
        honorificPreference: "阿嬤",
        culturalRegister: "indirect",
        conditions: "Type 2 diabetes; ROC ID A123456789 on chart",
        careNotesContext:
          "Lives at 台北市信義區信義路五段7號 with daughter",
        recentNotesSummary:
          "5/1: DOB 1942-03-22 noted on intake. 4/30: walked 15 min.",
        recentIncidents: "NHI card 000012345678 lost, replaced.",
      });

      expect(result.variableValues.conditions).toContain("[ROC_ID_REDACTED]");
      expect(result.variableValues.conditions).not.toContain("A123456789");

      expect(result.variableValues.care_context).toContain(
        "[ADDRESS_REDACTED]"
      );
      expect(result.variableValues.care_context).not.toContain("信義路五段7號");

      expect(result.variableValues.recent_notes_summary).toMatch(
        /early 1940s/
      );
      expect(result.variableValues.recent_notes_summary).not.toContain(
        "1942-03-22"
      );

      expect(result.variableValues.recent_incidents).toContain(
        "[ID_REDACTED]"
      );
      expect(result.variableValues.recent_incidents).not.toContain(
        "000012345678"
      );

      // Resident given names are intentionally NOT redacted (clinical
      // context demands being able to address the resident).
      expect(result.variableValues.resident_first_name).toBe("陳奶奶");
    });
  });
});
