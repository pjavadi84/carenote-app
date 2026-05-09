import { describe, it, expect } from "vitest";
import {
  CONSENT_TEXT_VERSION,
  renderCaregiverConsentText,
  renderFamilyContactConsentText,
} from "@/lib/pdpa/consent-text";

const familyParams = {
  orgName: "心安老人之家",
  dpoEmail: "privacy@example.com",
  contactName: "陳大華",
  residentName: "陳奶奶",
};

const caregiverParams = {
  orgName: "心安老人之家",
  dpoEmail: "privacy@example.com",
  caregiverName: "Siti",
};

describe("renderFamilyContactConsentText (zh-TW)", () => {
  it("interpolates contact + resident + org + DPO", () => {
    const text = renderFamilyContactConsentText(familyParams, "zh-TW");
    expect(text).toContain("陳大華");
    expect(text).toContain("陳奶奶");
    expect(text).toContain("心安老人之家");
    expect(text).toContain("privacy@example.com");
    expect(text).toContain(CONSENT_TEXT_VERSION);
  });

  it("frames the consent as the FAMILY MEMBER's own data, not the resident's", () => {
    const text = renderFamilyContactConsentText(familyParams, "zh-TW");
    expect(text).toContain("聯絡人");
    expect(text).toContain("家屬");
    // Categories should mention contact-data fields, not health data.
    expect(text).toContain("電子郵件");
    expect(text).toContain("關係");
  });

  it("zh-TW snapshot is clearly labeled provisional", () => {
    const text = renderFamilyContactConsentText(familyParams, "zh-TW");
    expect(text).toMatch(/暫行版本/);
  });

  it("English variant works for non-zh-TW orgs", () => {
    const text = renderFamilyContactConsentText(familyParams, "en");
    expect(text).toContain("Family Contact Personal Data");
    expect(text).toContain("陳大華");
    expect(text).toContain("陳奶奶");
  });
});

describe("renderCaregiverConsentText (zh-TW)", () => {
  it("interpolates caregiver + org + DPO", () => {
    const text = renderCaregiverConsentText(caregiverParams, "zh-TW");
    expect(text).toContain("Siti");
    expect(text).toContain("心安老人之家");
    expect(text).toContain("privacy@example.com");
  });

  it("explicitly notes id/vi/tl translations are NOT yet provided", () => {
    const text = renderCaregiverConsentText(caregiverParams, "zh-TW");
    expect(text).toMatch(/印尼文|vi|tl|越南/);
    expect(text).toMatch(/紙本/);
  });

  it("notes audio is not retained (only transcripts)", () => {
    const text = renderCaregiverConsentText(caregiverParams, "zh-TW");
    expect(text).toMatch(/語音/);
    expect(text).toMatch(/不留存|不保留/);
  });

  it("English variant flags id/vi/tl gap explicitly", () => {
    const text = renderCaregiverConsentText(caregiverParams, "en");
    expect(text).toMatch(/Indonesian/);
    expect(text).toMatch(/Vietnamese/);
    expect(text).toMatch(/Tagalog/);
    expect(text).toMatch(/paper/i);
  });
});
