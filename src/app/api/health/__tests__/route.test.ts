import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("/api/health", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ALL_VARS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ALL_VARS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("returns ok=false when core vars are missing", async () => {
    const res = await GET();
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

    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.categories.core.ok).toBe(true);
    // Voice still false — different category, not gating overall ok.
    expect(body.categories.voice.ok).toBe(false);
  });

  it("voice category goes ok=true once all three vapi vars are set", async () => {
    process.env.VAPI_ASSISTANT_ID = "asst_xxx";
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY = "pk_xxx";
    process.env.VAPI_WEBHOOK_SECRET = "whsec_xxx";

    const res = await GET();
    const body = await res.json();
    expect(body.categories.voice.ok).toBe(true);
    expect(body.categories.voice.vars).toEqual({
      VAPI_ASSISTANT_ID: true,
      NEXT_PUBLIC_VAPI_PUBLIC_KEY: true,
      VAPI_WEBHOOK_SECRET: true,
    });
  });

  it("treats empty strings as missing", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const res = await GET();
    const body = await res.json();
    expect(body.categories.core.vars.ANTHROPIC_API_KEY).toBe(false);
  });

  it("never echoes secret values (only booleans + flag values)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-SUPER-SECRET-VALUE";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-SECRET";
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";

    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("SUPER-SECRET-VALUE");
    expect(text).not.toContain("service-SECRET");
    // Flag VALUES are intentionally exposed (they're booleans / mode strings, not credentials).
    expect(text).toContain("true");
  });

  it("surfaces operational flag VALUES (not just presence)", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";
    process.env.DEMO_CONSULT_DISABLED = "true";

    const res = await GET();
    const body = await res.json();
    expect(body.flags.RETRY_FAILED_STRUCTURING_ENABLED).toBe("true");
    expect(body.flags.DEMO_CONSULT_DISABLED).toBe("true");
  });

  it("includes a timestamp", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
