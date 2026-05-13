import { describe, it, expect } from "vitest";
import {
  generateConfirmationToken,
  hashConfirmationToken,
  defaultExpiresAt,
  CONFIRMATION_EXPIRY_DAYS,
} from "../family-contact-confirmation";

describe("generateConfirmationToken", () => {
  it("returns an unsigned token and a matching sha256 hash", () => {
    const { unsigned, hash } = generateConfirmationToken();
    expect(unsigned).toBeTypeOf("string");
    expect(unsigned.length).toBeGreaterThanOrEqual(32);
    expect(hash).toBe(hashConfirmationToken(unsigned));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never collides across calls (256-bit entropy)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) {
      tokens.add(generateConfirmationToken().unsigned);
    }
    expect(tokens.size).toBe(50);
  });
});

describe("hashConfirmationToken", () => {
  it("is deterministic — same input produces same hash", () => {
    expect(hashConfirmationToken("abc")).toBe(hashConfirmationToken("abc"));
  });

  it("is sensitive to a single character change", () => {
    expect(hashConfirmationToken("abc")).not.toBe(hashConfirmationToken("abd"));
  });
});

describe("defaultExpiresAt", () => {
  it("returns a date approximately 30 days in the future", () => {
    const before = Date.now();
    const out = defaultExpiresAt();
    const after = Date.now();
    const expectedMin =
      before + CONFIRMATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const expectedMax =
      after + CONFIRMATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    expect(out.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(out.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
