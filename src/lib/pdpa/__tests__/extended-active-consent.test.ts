import { describe, it, expect, vi } from "vitest";
import {
  hasActiveFamilyContactConsent,
  hasCaregiverPdpaConsent,
} from "@/lib/pdpa/active-consent";

function mockSupabaseFamilyContact(opts: {
  count: number | null;
  error: unknown;
}) {
  const isFn = vi.fn().mockResolvedValue(opts);
  const eqFn = vi.fn().mockReturnValue({ is: isFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return {
    client: { from: fromFn } as unknown as Parameters<
      typeof hasActiveFamilyContactConsent
    >[0],
    fromFn,
    selectFn,
    eqFn,
    isFn,
  };
}

describe("hasActiveFamilyContactConsent", () => {
  it("queries family_contact_pdpa_consents and returns true when count > 0", async () => {
    const m = mockSupabaseFamilyContact({ count: 1, error: null });
    expect(await hasActiveFamilyContactConsent(m.client, "fc-1")).toBe(true);
    expect(m.fromFn).toHaveBeenCalledWith("family_contact_pdpa_consents");
    expect(m.eqFn).toHaveBeenCalledWith("family_contact_id", "fc-1");
    expect(m.isFn).toHaveBeenCalledWith("withdrawn_at", null);
  });

  it("returns false on count 0 / null / error", async () => {
    expect(
      await hasActiveFamilyContactConsent(
        mockSupabaseFamilyContact({ count: 0, error: null }).client,
        "fc-1"
      )
    ).toBe(false);
    expect(
      await hasActiveFamilyContactConsent(
        mockSupabaseFamilyContact({ count: null, error: null }).client,
        "fc-1"
      )
    ).toBe(false);
    expect(
      await hasActiveFamilyContactConsent(
        mockSupabaseFamilyContact({ count: null, error: new Error("x") }).client,
        "fc-1"
      )
    ).toBe(false);
  });
});

function mockSupabaseCaregiver(
  rows: Array<{ consent_type: string; accepted_at: string }> | null,
  error: unknown = null
) {
  const orderFn = vi
    .fn()
    .mockResolvedValue({ data: rows, error });
  const inFn = vi.fn().mockReturnValue({ order: orderFn });
  const eqFn = vi.fn().mockReturnValue({ in: inFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return {
    client: { from: fromFn } as unknown as Parameters<
      typeof hasCaregiverPdpaConsent
    >[0],
    fromFn,
    selectFn,
    eqFn,
    inFn,
    orderFn,
  };
}

describe("hasCaregiverPdpaConsent", () => {
  it("returns false when no rows exist", async () => {
    const m = mockSupabaseCaregiver([]);
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(false);
    expect(m.fromFn).toHaveBeenCalledWith("consent_records");
  });

  it("returns true when most recent row is self_ack", async () => {
    const m = mockSupabaseCaregiver([
      { consent_type: "caregiver_pdpa_self_ack", accepted_at: "2026-05-09" },
    ]);
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(true);
  });

  it("returns true when most recent row is paper", async () => {
    const m = mockSupabaseCaregiver([
      { consent_type: "caregiver_pdpa_paper", accepted_at: "2026-05-09" },
    ]);
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(true);
  });

  it("returns false when most recent row is withdraw (even if older accept exists)", async () => {
    const m = mockSupabaseCaregiver([
      { consent_type: "caregiver_pdpa_withdraw", accepted_at: "2026-05-09" },
      { consent_type: "caregiver_pdpa_paper", accepted_at: "2026-04-01" },
    ]);
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(false);
  });

  it("returns true when re-accept after withdraw is most recent", async () => {
    const m = mockSupabaseCaregiver([
      { consent_type: "caregiver_pdpa_paper", accepted_at: "2026-05-09" },
      { consent_type: "caregiver_pdpa_withdraw", accepted_at: "2026-04-15" },
      { consent_type: "caregiver_pdpa_paper", accepted_at: "2026-04-01" },
    ]);
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(true);
  });

  it("returns false on error", async () => {
    const m = mockSupabaseCaregiver(null, new Error("boom"));
    expect(await hasCaregiverPdpaConsent(m.client, "user-1")).toBe(false);
  });
});
