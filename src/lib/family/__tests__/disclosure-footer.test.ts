import { describe, it, expect } from "vitest";
import {
  appendFamilyDisclosureFooter,
  buildFamilyDisclosureFooter,
  localeForRegulatoryRegion,
} from "@/lib/family/disclosure-footer";

describe("localeForRegulatoryRegion", () => {
  it("maps pdpa_tw to zh-TW", () => {
    expect(localeForRegulatoryRegion("pdpa_tw")).toBe("zh-TW");
  });

  it("falls back to en for hipaa_us, gdpr_eu, null, undefined", () => {
    expect(localeForRegulatoryRegion("hipaa_us")).toBe("en");
    expect(localeForRegulatoryRegion("gdpr_eu")).toBe("en");
    expect(localeForRegulatoryRegion(null)).toBe("en");
    expect(localeForRegulatoryRegion(undefined)).toBe("en");
  });
});

describe("buildFamilyDisclosureFooter", () => {
  it("renders the four mandated elements in English", () => {
    const text = buildFamilyDisclosureFooter({
      clinicianName: "Dr. Lin",
      replyTo: "clinic@example.com",
      locale: "en",
    });
    // (1) AI assistance, (2) clinician review, (3) reviewer name, (4) contact
    expect(text).toMatch(/AI assistance/i);
    expect(text).toMatch(/reviewed by Dr\. Lin/);
    expect(text).toMatch(/clinic@example\.com/);
  });

  it("renders zh-TW with the reviewer + contact interpolated", () => {
    const text = buildFamilyDisclosureFooter({
      clinicianName: "林醫師",
      replyTo: "clinic@example.com",
      locale: "zh-TW",
    });
    expect(text).toContain("林醫師");
    expect(text).toContain("clinic@example.com");
    expect(text).toContain("AI 協助撰寫");
    expect(text).toContain("審閱");
  });

  it("falls back to 'the clinical team' when clinician name is blank", () => {
    const text = buildFamilyDisclosureFooter({
      clinicianName: "   ",
      replyTo: "x@y.z",
      locale: "en",
    });
    expect(text).toMatch(/the clinical team/);
  });
});

describe("appendFamilyDisclosureFooter", () => {
  it("trims trailing whitespace from body and adds the footer with a blank line", () => {
    const out = appendFamilyDisclosureFooter("Hello family.\n\n", "—\nfooter");
    expect(out).toBe("Hello family.\n\n—\nfooter\n");
  });

  it("does not duplicate footer if called once", () => {
    const footer = "—\nfooter";
    const out = appendFamilyDisclosureFooter("Body", footer);
    expect(out.split("—\nfooter")).toHaveLength(2);
  });
});
