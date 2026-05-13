import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Minimal mock state: the route under test reads `users`, then
// `family_communications` (joined to family_contacts), then `organizations`.
// Each `.single()` call returns whatever has been set in `tableSingle` for
// that table name. Mutations (.update/.insert) are no-ops that resolve with
// no error so the test focuses on the gate logic, not the persistence side.
const { mockState } = vi.hoisted(() => ({
  mockState: {
    user: { id: "admin-1", email: "admin@kinroster.com" } as
      | { id: string; email: string }
      | null,
    tableSingle: new Map<string, unknown>(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const fromMock = vi.fn((table: string) => {
      const builder: Record<string, unknown> = { _table: table };
      const passthrough = (...names: string[]) => {
        for (const n of names) {
          builder[n] = vi.fn(() => builder);
        }
      };
      passthrough("select", "eq", "in", "is", "gte", "lte", "order");
      builder.single = vi.fn(async () => ({
        data: mockState.tableSingle.get(table) ?? null,
        error: null,
      }));
      builder.update = vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
      }));
      builder.insert = vi.fn(async () => ({ data: null, error: null }));
      return builder;
    });

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockState.user },
          error: null,
        }),
      },
      from: fromMock,
    };
  }),
}));

vi.mock("@/lib/resend", () => ({
  sendFamilyEmail: vi.fn(async () => ({ id: "email-id" })),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(async () => undefined),
}));

import { POST } from "../route";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/family/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseContact(overrides: Record<string, unknown> = {}) {
  return {
    email: "family@example.com",
    name: "Family Member",
    involved_in_care: true,
    personal_representative: false,
    authorization_on_file: false,
    authorization_end_date: null,
    revoked_at: null,
    authorization_scope: [],
    email_confirmed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function setHappyPathState() {
  mockState.user = { id: "admin-1", email: "admin@kinroster.com" };
  mockState.tableSingle = new Map();
  mockState.tableSingle.set("users", {
    organization_id: "org-1",
    role: "admin",
    full_name: "Admin User",
  });
  mockState.tableSingle.set("family_communications", {
    id: "comm-1",
    organization_id: "org-1",
    resident_id: "res-1",
    recipient_contact_id: "fc-1",
    source_note_ids: null,
    subject: "Update",
    body: "Body",
    status: "draft",
    family_contacts: baseContact(),
  });
  mockState.tableSingle.set("organizations", {
    name: "Test Facility",
    email_from_name: null,
    email_reply_to: null,
    settings: {},
    regulatory_region: "hipaa_us",
  });
}

beforeEach(() => {
  setHappyPathState();
});

describe("POST /api/family/send — email confirmation gate", () => {
  it("returns 412 with email_not_confirmed code when contact has not confirmed", async () => {
    mockState.tableSingle.set("family_communications", {
      id: "comm-1",
      organization_id: "org-1",
      resident_id: "res-1",
      recipient_contact_id: "fc-1",
      source_note_ids: null,
      subject: "Update",
      body: "Body",
      status: "draft",
      family_contacts: baseContact({ email_confirmed_at: null }),
    });

    const res = await POST(makeRequest({ communicationId: "comm-1" }));
    expect(res.status).toBe(412);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("email_not_confirmed");
    expect(body.error).toMatch(/confirmation/i);
  });

  it("proceeds past the gate when email_confirmed_at is populated", async () => {
    const res = await POST(makeRequest({ communicationId: "comm-1" }));
    // Past the gate. The route still needs orgs/settings to fully succeed —
    // any non-412 response confirms the gate didn't block.
    expect(res.status).not.toBe(412);
  });

  it("returns 401 with no user", async () => {
    mockState.user = null;
    const res = await POST(makeRequest({ communicationId: "comm-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin role", async () => {
    mockState.tableSingle.set("users", {
      organization_id: "org-1",
      role: "caregiver",
      full_name: "Caregiver",
    });
    const res = await POST(makeRequest({ communicationId: "comm-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the contact has no email", async () => {
    mockState.tableSingle.set("family_communications", {
      id: "comm-1",
      organization_id: "org-1",
      resident_id: "res-1",
      recipient_contact_id: "fc-1",
      source_note_ids: null,
      subject: "Update",
      body: "Body",
      status: "draft",
      family_contacts: baseContact({ email: null }),
    });

    const res = await POST(makeRequest({ communicationId: "comm-1" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/email/i);
  });
});
