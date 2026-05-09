import { describe, it, expect, vi } from "vitest";
import {
  hasActivePdpaConsent,
  pdpaConsentRequired,
} from "@/lib/pdpa/active-consent";

describe("pdpaConsentRequired", () => {
  it("is false by default (off when settings null/missing)", () => {
    expect(pdpaConsentRequired(null)).toBe(false);
    expect(pdpaConsentRequired(undefined)).toBe(false);
    expect(pdpaConsentRequired({})).toBe(false);
  });

  it("is true only when settings.pdpa_consent_required === true", () => {
    expect(pdpaConsentRequired({ pdpa_consent_required: true })).toBe(true);
    expect(pdpaConsentRequired({ pdpa_consent_required: false })).toBe(false);
    expect(pdpaConsentRequired({ pdpa_consent_required: "yes" })).toBe(false);
    expect(pdpaConsentRequired({ pdpa_consent_required: 1 })).toBe(false);
  });
});

function mockSupabase(opts: { count: number | null; error: unknown }) {
  const isFn = vi.fn().mockResolvedValue(opts);
  const eqFn = vi.fn().mockReturnValue({ is: isFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return {
    client: { from: fromFn } as unknown as Parameters<
      typeof hasActivePdpaConsent
    >[0],
    selectFn,
    eqFn,
    isFn,
    fromFn,
  };
}

describe("hasActivePdpaConsent", () => {
  it("returns true when count > 0", async () => {
    const m = mockSupabase({ count: 1, error: null });
    expect(await hasActivePdpaConsent(m.client, "resident-1")).toBe(true);
    expect(m.fromFn).toHaveBeenCalledWith("resident_pdpa_consents");
    expect(m.selectFn).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(m.eqFn).toHaveBeenCalledWith("resident_id", "resident-1");
    expect(m.isFn).toHaveBeenCalledWith("withdrawn_at", null);
  });

  it("returns false when count === 0", async () => {
    const m = mockSupabase({ count: 0, error: null });
    expect(await hasActivePdpaConsent(m.client, "resident-1")).toBe(false);
  });

  it("returns false (conservative) on error", async () => {
    const m = mockSupabase({ count: null, error: new Error("boom") });
    expect(await hasActivePdpaConsent(m.client, "resident-1")).toBe(false);
  });

  it("treats null count as zero", async () => {
    const m = mockSupabase({ count: null, error: null });
    expect(await hasActivePdpaConsent(m.client, "resident-1")).toBe(false);
  });
});
