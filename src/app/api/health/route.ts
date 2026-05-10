import { NextResponse } from "next/server";

// Public diagnostic endpoint for ops + on-call. Reports which required
// env vars are PRESENT (boolean only — never the value), grouped by
// the surface they enable. Use this to confirm a Vercel project has
// been wired up correctly when, e.g., notes are stuck in "Pending"
// (almost always missing ANTHROPIC_API_KEY) or voice calls never
// reach the webhook (missing VAPI_WEBHOOK_SECRET).
//
// Safe to expose without auth: presence-of-secret leaks "we use
// service X" but no values. The companion /api/demo/health endpoint
// has a narrower scope (just the demo); this one is comprehensive.
//
// Output shape (200 always — caller decides what to alert on):
//   {
//     ok: boolean,                    // every "core" var is present
//     ts: ISO timestamp,
//     categories: {
//       core:    { ok, vars: { NAME: bool } },     // app cannot function without these
//       voice:   { ok, vars: { ... } },            // voice intake disabled if missing
//       email:   { ok, vars: { ... } },            // family-update + clinician-share email
//       cron:    { ok, vars: { ... } },            // background jobs
//       billing: { ok, vars: { ... } },            // optional unless paywalled
//     }
//   }

interface CategoryReport {
  ok: boolean;
  vars: Record<string, boolean>;
}

function present(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function build(vars: string[]): CategoryReport {
  const result: Record<string, boolean> = {};
  for (const name of vars) result[name] = present(name);
  return {
    ok: vars.every((n) => result[n]),
    vars: result,
  };
}

export async function GET() {
  const categories = {
    core: build([
      "ANTHROPIC_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_APP_URL",
    ]),
    voice: build([
      "VAPI_ASSISTANT_ID",
      "NEXT_PUBLIC_VAPI_PUBLIC_KEY",
      "VAPI_WEBHOOK_SECRET",
    ]),
    email: build(["RESEND_API_KEY", "RESEND_DOMAIN"]),
    cron: build(["CRON_SECRET"]),
    billing: build([
      "STRIPE_SECRET_KEY",
      "STRIPE_PRICE_ID",
      "STRIPE_WEBHOOK_SECRET",
    ]),
  };

  // Operational flags (values shown — these are not secrets, they're
  // boolean-ish toggles whose state matters for diagnosis).
  const flags = {
    RETRY_FAILED_STRUCTURING_ENABLED:
      process.env.RETRY_FAILED_STRUCTURING_ENABLED ?? null,
    DEMO_CONSULT_DISABLED: process.env.DEMO_CONSULT_DISABLED ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };

  return NextResponse.json({
    ok: categories.core.ok,
    ts: new Date().toISOString(),
    categories,
    flags,
  });
}
