import { describe, it, expect, vi } from "vitest";

// Mock Anthropic SDK to avoid browser detection error
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(),
}));

// Import after mock
const { parseJsonResponse } = await import("../claude");

describe("parseJsonResponse", () => {
  it("parses valid JSON", () => {
    const result = parseJsonResponse<{ foo: string }>('{"foo": "bar"}');
    expect(result.foo).toBe("bar");
  });

  it("strips markdown code fences", () => {
    const result = parseJsonResponse<{ foo: string }>(
      '```json\n{"foo": "bar"}\n```'
    );
    expect(result.foo).toBe("bar");
  });

  it("strips code fences without language hint", () => {
    const result = parseJsonResponse<{ foo: string }>(
      '```\n{"foo": "bar"}\n```'
    );
    expect(result.foo).toBe("bar");
  });

  it("handles whitespace", () => {
    const result = parseJsonResponse<{ a: number }>('  { "a": 1 }  ');
    expect(result.a).toBe(1);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonResponse("not json")).toThrow();
  });

  it("parses complex structured note output", () => {
    const output = JSON.stringify({
      summary: "Test summary",
      sections: { "Mood & Behavior": "Good mood" },
      follow_up: "None noted.",
      flags: [{ type: "fall_risk", reason: "near fall" }],
    });
    const result = parseJsonResponse<{
      summary: string;
      flags: Array<{ type: string }>;
    }>(output);
    expect(result.summary).toBe("Test summary");
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("fall_risk");
  });
});
