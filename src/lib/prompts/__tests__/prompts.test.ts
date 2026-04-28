import { describe, it, expect } from "vitest";
import {
  SHIFT_NOTE_SYSTEM_PROMPT,
  buildShiftNoteUserPrompt,
} from "../shift-note";
import {
  INCIDENT_CLASSIFY_SYSTEM_PROMPT,
  buildIncidentClassifyUserPrompt,
} from "../incident-classify";
import {
  INCIDENT_REPORT_SYSTEM_PROMPT,
  buildIncidentReportUserPrompt,
} from "../incident-report";
import {
  FAMILY_UPDATE_SYSTEM_PROMPT,
  buildFamilyUpdateUserPrompt,
} from "../family-update";
import {
  WEEKLY_SUMMARY_SYSTEM_PROMPT,
  buildWeeklySummaryUserPrompt,
} from "../weekly-summary";

describe("Shift Note Prompt", () => {
  it("system prompt contains key safety rules", () => {
    expect(SHIFT_NOTE_SYSTEM_PROMPT).toContain("NEVER add recommendations");
    expect(SHIFT_NOTE_SYSTEM_PROMPT).toContain("NEVER speculate");
    expect(SHIFT_NOTE_SYSTEM_PROMPT).toContain("valid JSON only");
  });

  it("builds user prompt with all fields", () => {
    const prompt = buildShiftNoteUserPrompt({
      residentFirstName: "Dorothy",
      residentLastName: "Chen",
      careNotesContext: "Likes garden walks",
      conditions: "dementia",
      timestamp: "2026-04-05T12:00:00Z",
      caregiverName: "James",
      rawInput: "dorothy was happy today",
    });

    expect(prompt).toContain("Dorothy Chen");
    expect(prompt).toContain("Likes garden walks");
    expect(prompt).toContain("dementia");
    expect(prompt).toContain("James");
    expect(prompt).toContain("dorothy was happy today");
  });

  it("handles null context gracefully", () => {
    const prompt = buildShiftNoteUserPrompt({
      residentFirstName: "Test",
      residentLastName: "User",
      careNotesContext: null,
      conditions: null,
      timestamp: "2026-04-05",
      caregiverName: "Carer",
      rawInput: "test",
    });

    expect(prompt).toContain("None provided");
    expect(prompt).toContain("None documented");
  });
});

describe("Incident Classification Prompt", () => {
  it("system prompt defines all three classifications", () => {
    expect(INCIDENT_CLASSIFY_SYSTEM_PROMPT).toContain("ROUTINE");
    expect(INCIDENT_CLASSIFY_SYSTEM_PROMPT).toContain("POSSIBLE_INCIDENT");
    expect(INCIDENT_CLASSIFY_SYSTEM_PROMPT).toContain("DEFINITE_INCIDENT");
  });

  it("builds user prompt with raw input", () => {
    const prompt = buildIncidentClassifyUserPrompt("resident fell");
    expect(prompt).toContain("resident fell");
  });
});

describe("Incident Report Prompt", () => {
  it("system prompt emphasizes objectivity", () => {
    expect(INCIDENT_REPORT_SYSTEM_PROMPT).toContain("Do NOT speculate");
    expect(INCIDENT_REPORT_SYSTEM_PROMPT).toContain("Do NOT assign blame");
    expect(INCIDENT_REPORT_SYSTEM_PROMPT).toContain("Not documented");
  });

  it("builds user prompt with resident info", () => {
    const prompt = buildIncidentReportUserPrompt({
      residentFirstName: "Dorothy",
      residentLastName: "Chen",
      conditions: "dementia",
      timestamp: "2026-04-05",
      caregiverName: "James",
      rawInput: "dorothy fell in bathroom",
    });

    expect(prompt).toContain("Dorothy Chen");
    expect(prompt).toContain("dorothy fell in bathroom");
  });
});

describe("Family Update Prompt", () => {
  it("system prompt enforces warm tone and no medical jargon", () => {
    expect(FAMILY_UPDATE_SYSTEM_PROMPT).toContain("warm, conversational tone");
    expect(FAMILY_UPDATE_SYSTEM_PROMPT).toContain("NEVER use clinical language");
    expect(FAMILY_UPDATE_SYSTEM_PROMPT).toContain("NEVER invent details");
  });

  it("builds user prompt with notes", () => {
    const prompt = buildFamilyUpdateUserPrompt({
      facilityName: "Sunrise",
      residentFirstName: "Dorothy",
      residentLastName: "Chen",
      familyContactName: "Sarah",
      relationship: "Daughter",
      dateRangeStart: "2026-03-29",
      dateRangeEnd: "2026-04-05",
      notes: [
        {
          created_at: "2026-04-01",
          author_name: "James",
          structured_output: "Good day",
        },
      ],
    });

    expect(prompt).toContain("Sunrise");
    expect(prompt).toContain("Sarah (Daughter)");
    expect(prompt).toContain("Good day");
  });
});

describe("Weekly Summary Prompt", () => {
  it("system prompt specifies required sections", () => {
    expect(WEEKLY_SUMMARY_SYSTEM_PROMPT).toContain("Overall Status");
    expect(WEEKLY_SUMMARY_SYSTEM_PROMPT).toContain("Nutrition & Appetite");
    expect(WEEKLY_SUMMARY_SYSTEM_PROMPT).toContain("Incidents");
  });

  it("builds user prompt with notes and shift info", () => {
    const prompt = buildWeeklySummaryUserPrompt({
      facilityName: "Sunrise",
      residentFirstName: "Dorothy",
      residentLastName: "Chen",
      conditions: "dementia",
      careNotesContext: "Prefers quiet evenings",
      weekStart: "2026-03-30",
      weekEnd: "2026-04-05",
      notes: [
        {
          created_at: "2026-04-01",
          author_name: "James",
          shift: "morning",
          structured_output: "Good morning",
        },
      ],
    });

    expect(prompt).toContain("Dorothy Chen");
    expect(prompt).toContain("Prefers quiet evenings");
    expect(prompt).toContain("morning");
    expect(prompt).toContain("Good morning");
  });
});
