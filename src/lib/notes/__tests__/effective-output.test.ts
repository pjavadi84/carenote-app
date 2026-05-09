import { describe, it, expect } from "vitest";
import { getEffectiveStructuredOutput } from "@/lib/notes/effective-output";

describe("getEffectiveStructuredOutput", () => {
  it("returns edited_output when both columns are non-null", () => {
    expect(
      getEffectiveStructuredOutput({
        structured_output: "ai version",
        edited_output: "corrected version",
      })
    ).toBe("corrected version");
  });

  it("returns structured_output when edited_output is null", () => {
    expect(
      getEffectiveStructuredOutput({
        structured_output: "ai version",
        edited_output: null,
      })
    ).toBe("ai version");
  });

  it("returns null when both are null", () => {
    expect(
      getEffectiveStructuredOutput({
        structured_output: null,
        edited_output: null,
      })
    ).toBeNull();
  });

  it("preserves an empty edited_output as a deliberate erase (??, not ||)", () => {
    // A caregiver who deliberately blanked the structured copy should not
    // have the AI draft re-surface. Using ?? rather than || enforces this.
    expect(
      getEffectiveStructuredOutput({
        structured_output: "ai version",
        edited_output: "",
      })
    ).toBe("");
  });
});
