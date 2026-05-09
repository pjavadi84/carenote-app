import { describe, it, expect } from "vitest";
import {
  ATTORNEY_REVIEWED,
  CONSENT_TEXT_VERSION,
  renderConsentText,
} from "@/lib/pdpa/consent-text";

const params = {
  orgName: "心安老人之家",
  dpoEmail: "privacy@example.com",
  residentName: "陳奶奶",
};

describe("consent-text", () => {
  it("ships as v0 provisional, not attorney-reviewed", () => {
    expect(CONSENT_TEXT_VERSION).toMatch(/^v0-provisional/);
    expect(ATTORNEY_REVIEWED).toBe(false);
  });

  it("zh-TW snapshot interpolates org, DPO, resident name", () => {
    const text = renderConsentText(params, "zh-TW");
    expect(text).toContain("心安老人之家");
    expect(text).toContain("privacy@example.com");
    expect(text).toContain("陳奶奶");
    expect(text).toContain(CONSENT_TEXT_VERSION);
  });

  it("zh-TW snapshot lists every required PDPA element", () => {
    const text = renderConsentText(params, "zh-TW");
    // 1. Data controller, 2. Subject, 3. Purpose, 4. Categories,
    // 5. Period/region/recipients/method, 6. Rights, 7. Withdrawal,
    // 8. Refusal effect, 9. Effective date.
    for (const heading of [
      "資料控制者",
      "資料當事人",
      "蒐集目的",
      "個人資料類別",
      "處理與利用",
      "權利",
      "撤回",
      "不提供",
      "生效",
    ]) {
      expect(text, `missing element: ${heading}`).toContain(heading);
    }
  });

  it("zh-TW snapshot names the AI sub-processors and the cross-border transfer", () => {
    const text = renderConsentText(params, "zh-TW");
    expect(text).toContain("Anthropic");
    expect(text).toContain("OpenAI");
    expect(text).toContain("Resend");
    expect(text).toContain("Supabase");
    expect(text).toContain("Vercel");
    expect(text).toContain("跨境傳輸");
  });

  it("zh-TW snapshot is clearly labeled provisional", () => {
    const text = renderConsentText(params, "zh-TW");
    expect(text).toMatch(/暫行版本/);
    expect(text).toMatch(/律師/);
  });

  it("English snapshot is functional fallback for non-zh-TW orgs", () => {
    const text = renderConsentText(params, "en");
    expect(text).toContain("心安老人之家");
    expect(text).toContain("privacy@example.com");
    expect(text).toContain("陳奶奶");
    expect(text).toMatch(/Provisional/);
    expect(text).toMatch(/Personal Data Protection Act/);
  });
});
