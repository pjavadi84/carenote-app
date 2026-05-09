import { describe, it, expect } from "vitest";
import {
  getEffectiveStructuredOutput,
  getEffectiveStructuredOutputForLlm,
} from "@/lib/notes/effective-output";

describe("getEffectiveStructuredOutputForLlm", () => {
  it("returns null when both columns are null", () => {
    expect(
      getEffectiveStructuredOutputForLlm({
        structured_output: null,
        edited_output: null,
      })
    ).toBeNull();
  });

  it("redacts PHI from edited_output when present", () => {
    const out = getEffectiveStructuredOutputForLlm({
      structured_output: "ignored AI draft",
      edited_output:
        "Patient ROC ID A123456789 lives at 台北市信義區信義路五段7號. DOB 1942-03-22.",
    });
    expect(out).toContain("[ROC_ID_REDACTED]");
    expect(out).toContain("[ADDRESS_REDACTED]");
    expect(out).toMatch(/early 1940s/);
    expect(out).not.toContain("A123456789");
    expect(out).not.toContain("信義路五段7號");
  });

  it("falls back to structured_output when edited_output is null, then redacts", () => {
    const out = getEffectiveStructuredOutputForLlm({
      structured_output: "Resident ID A287654321 noted.",
      edited_output: null,
    });
    expect(out).toContain("[ROC_ID_REDACTED]");
    expect(out).not.toContain("A287654321");
  });

  it("preserves clean clinical text unchanged", () => {
    const text = "Dorothy ate full lunch and walked 15 minutes.";
    expect(
      getEffectiveStructuredOutputForLlm({
        structured_output: text,
        edited_output: null,
      })
    ).toBe(text);
  });

  it("plain getEffectiveStructuredOutput stays unredacted (UI rendering path)", () => {
    const text = "ROC ID A123456789 noted.";
    expect(
      getEffectiveStructuredOutput({
        structured_output: text,
        edited_output: null,
      })
    ).toBe(text);
  });
});
