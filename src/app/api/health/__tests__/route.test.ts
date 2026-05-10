import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";

const ALL_VARS = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "VAPI_ASSISTANT_ID",
  "NEXT_PUBLIC_VAPI_PUBLIC_KEY",
  "VAPI_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_DOMAIN",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "RETRY_FAILED_STRUCTURING_ENABLED",
  "DEMO_CONSULT_DISABLED",
];

function makeRequest(url = "http://localhost/api/health") {
  return new NextRequest(url);
}

// Anthropic + Supabase mocks. vi.mock() is hoisted above the import of
// the route under test, so the mock-factory references must be hoisted
// alongside via vi.hoisted() — otherwise they're in TDZ when the
// factory runs.
const { anthropicListMock, supabaseSelectMock } = vi.hoisted(() => ({
  anthropicListMock: vi.fn(),
  supabaseSelectMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: function MockAnthropic() {
    return { models: { list: anthropicListMock } };
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: supabaseSelectMock }),
  }),
}));

describe("/api/health", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ALL_VARS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
    anthropicListMock.mockReset();
    supabaseSelectMock.mockReset();
  });

  afterEach(() => {
    for (const k of ALL_VARS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("returns ok=false when core vars are missing", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.categories.core.ok).toBe(false);
    expect(body.categories.core.vars.ANTHROPIC_API_KEY).toBe(false);
    expect(body.categories.core.vars.SUPABASE_SERVICE_ROLE_KEY).toBe(false);
  });

  it("returns ok=true once every core var is present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.NEXT_PUBLIC_APP_URL = "https://kinroster-tw.vercel.app";

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.categories.core.ok).toBe(true);
    expect(body.categories.voice.ok).toBe(false);
  });

  it("voice category goes ok=true once all three vapi vars are set", async () => {
    process.env.VAPI_ASSISTANT_ID = "asst_xxx";
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = "pk_xxx";
    process.env.VAPI_WEBHOOK_SECRET = "whsec_xxx";

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.categories.voice.ok).toBe(true);
  });

  it("treats empty strings as missing", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.categories.core.vars.ANTHROPIC_API_KEY).toBe(false);
  });

  it("never echoes secret values (only booleans + flag values)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-SUPER-SECRET-VALUE";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-SECRET";
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";

    const res = await GET(makeRequest());
    const text = await res.text();
    expect(text).not.toContain("SUPER-SECRET-VALUE");
    expect(text).not.toContain("service-SECRET");
    expect(text).toContain("true");
  });

  it("surfaces operational flag VALUES (not just presence)", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";
    process.env.DEMO_CONSULT_DISABLED = "true";

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.flags.RETRY_FAILED_STRUCTURING_ENABLED).toBe("true");
    expect(body.flags.DEMO_CONSULT_DISABLED).toBe("true");
  });

  it("includes a timestamp", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does NOT run deep checks by default (no ?deep=1)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.deep).toBeUndefined();
    expect(anthropicListMock).not.toHaveBeenCalled();
    expect(supabaseSelectMock).not.toHaveBeenCalled();
  });

  it("?deep=1 with valid creds returns deep.*.ok=true", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.NEXT_PUBLIC_APP_URL = "https://x";

    anthropicListMock.mockResolvedValue({ data: [] });
    supabaseSelectMock.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest("http://localhost/api/health?deep=1")
    );
    const body = await res.json();
    expect(body.deep).toBeDefined();
    expect(body.deep.anthropic.ok).toBe(true);
    expect(body.deep.supabase.ok).toBe(true);
    expect(typeof body.deep.anthropic.latency_ms).toBe("number");
  });

  it("?deep=1 short-circuits with missing_env when keys are absent", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/health?deep=1")
    );
    const body = await res.json();
    expect(body.deep.anthropic.ok).toBe(false);
    expect(body.deep.anthropic.error_class).toBe("missing_env");
    expect(body.deep.supabase.ok).toBe(false);
    expect(body.deep.supabase.error_class).toBe("missing_env");
    expect(anthropicListMock).not.toHaveBeenCalled();
    expect(supabaseSelectMock).not.toHaveBeenCalled();
  });

  it("?deep=1 maps Anthropic 401 to error_class=auth", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-bogus";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

    const authErr = Object.assign(new Error("Invalid API key"), {
      status: 401,
    });
    anthropicListMock.mockRejectedValue(authErr);
    supabaseSelectMock.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest("http://localhost/api/health?deep=1")
    );
    const body = await res.json();
    expect(body.deep.anthropic.ok).toBe(false);
    expect(body.deep.anthropic.error_class).toBe("auth");
  });

  it("?deep=1 maps Supabase JWT error to error_class=auth", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "wrong-key";

    anthropicListMock.mockResolvedValue({ data: [] });
    supabaseSelectMock.mockResolvedValue({
      error: { message: "JWT expired", code: "PGRST301" },
    });

    const res = await GET(
      makeRequest("http://localhost/api/health?deep=1")
    );
    const body = await res.json();
    expect(body.deep.supabase.ok).toBe(false);
    expect(body.deep.supabase.error_class).toBe("auth");
  });

  it("?deep=1 never echoes the actual error message text", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-bogus";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";

    anthropicListMock.mockRejectedValue(
      Object.assign(new Error("Internal hostname leak: kinroster-prod-db-01.internal"), {
        status: 500,
      })
    );
    supabaseSelectMock.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest("http://localhost/api/health?deep=1")
    );
    const text = await res.text();
    expect(text).not.toContain("kinroster-prod-db-01");
    expect(text).not.toContain("Internal hostname leak");
  });
});
