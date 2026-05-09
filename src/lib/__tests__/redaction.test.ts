import { describe, it, expect } from "vitest";
import { redactPhi, redactPhiText, hasRedactions } from "@/lib/redaction";

describe("redaction", () => {
  it("redacts Taiwan ROC IDs", () => {
    const { text, stats } = redactPhi(
      "Patient ID A123456789. Backup card B287654321."
    );
    expect(text).not.toContain("A123456789");
    expect(text).not.toContain("B287654321");
    expect(text).toContain("[ROC_ID_REDACTED]");
    expect(stats.rocId).toBe(2);
  });

  it("redacts 12-digit IDs (Vietnamese CCCD / Taiwan NHI card)", () => {
    const cccd = redactPhi("CCCD: 012345678901 cấp ngày...");
    expect(cccd.text).not.toContain("012345678901");
    expect(cccd.text).toContain("[ID_REDACTED]");
    expect(cccd.stats.id12).toBe(1);

    const nhi = redactPhi("健保卡卡號 000012345678 已掛號");
    expect(nhi.text).not.toContain("000012345678");
    expect(nhi.text).toContain("[ID_REDACTED]");
    expect(nhi.stats.id12).toBe(1);
  });

  it("redacts Indonesian NIK (16-digit) before 12-digit IDs", () => {
    const { text, stats } = redactPhi("NIK 1234567890123456 born 1942-03-22");
    expect(text).toContain("[NIK_REDACTED]");
    expect(text).not.toContain("1234567890123456");
    expect(stats.nik).toBe(1);
    expect(stats.id12).toBe(0);
  });

  it("redacts ISO and US-style DOBs into year bands", () => {
    const result = redactPhi("DOB 1942-12-01. Sister born 03/22/1985.");
    expect(result.text).toContain("early 1940s");
    expect(result.text).toContain("mid 1980s");
    expect(result.stats.dob).toBe(2);
  });

  it("redacts US street addresses", () => {
    const result = redactPhi("Family lives at 123 Main Street, Apt 4.");
    expect(result.text).toContain("[ADDRESS_REDACTED]");
    expect(result.text).not.toContain("123 Main Street");
    expect(result.stats.address).toBe(1);
  });

  it("redacts Taiwan addresses with city + district + road + section + 號", () => {
    const cases = [
      "她住在台北市信義區信義路五段7號，靠近捷運站。",
      "100台北市中正區忠孝東路一段1號",
      "新北市板橋區文化路二段242巷15弄8號3樓",
      "高雄市鳳山區建國路三段50號之2",
    ];
    for (const input of cases) {
      const { text, stats } = redactPhi(input);
      expect(text, `should redact: ${input}`).toContain("[ADDRESS_REDACTED]");
      // None of the original digit strings should remain.
      expect(text).not.toMatch(/\d+號/u);
      expect(stats.address).toBeGreaterThanOrEqual(1);
    }
  });

  it("redacts partial Taiwan addresses (road + 號 only, no city preamble)", () => {
    const { text, stats } = redactPhi("地址：信義路五段7號");
    expect(text).toContain("[ADDRESS_REDACTED]");
    expect(text).not.toContain("信義路五段7號");
    expect(stats.address).toBe(1);
  });

  it("does NOT redact bare city/district references without a 號 anchor", () => {
    // Conservative-redaction policy: we accept some under-redaction here
    // because "她住在台北市" is not uniquely identifying.
    const { text, stats } = redactPhi("她住在台北市，喜歡公園散步。");
    expect(text).toBe("她住在台北市，喜歡公園散步。");
    expect(stats.address).toBe(0);
  });

  it("redacts SSNs", () => {
    const result = redactPhi("SSN 123-45-6789 on file.");
    expect(result.text).toContain("[SSN_REDACTED]");
    expect(result.stats.ssn).toBe(1);
  });

  it("preserves resident first names and clinical content (English)", () => {
    const text =
      "Dorothy was in good spirits, ate full lunch, walked 15 minutes in garden. Pain 4/10 in left hip.";
    const { text: out, stats } = redactPhi(text);
    expect(out).toBe(text);
    expect(hasRedactions(stats)).toBe(false);
  });

  it("preserves clinical content in zh-TW that contains no address or ID", () => {
    const text = "陳奶奶今天精神不錯，午餐全部吃完，散步十五分鐘。左髖關節疼痛 4/10。";
    const { text: out, stats } = redactPhi(text);
    expect(out).toBe(text);
    expect(hasRedactions(stats)).toBe(false);
  });

  it("redactPhiText returns just the redacted string", () => {
    const out = redactPhiText("ROC ID A123456789");
    expect(out).toContain("[ROC_ID_REDACTED]");
  });

  it("hasRedactions reports zero for clean text", () => {
    const { stats } = redactPhi("nothing sensitive here, ate cereal");
    expect(hasRedactions(stats)).toBe(false);
  });

  it("handles empty input", () => {
    const { text, stats } = redactPhi("");
    expect(text).toBe("");
    expect(stats.rocId).toBe(0);
  });
});
