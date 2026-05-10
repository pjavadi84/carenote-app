import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

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
// Pass ?deep=1 to additionally make a real authenticated call against
// each upstream (Anthropic models.list, Supabase trivial query). This
// confirms the keys aren't just SET but are VALID + reachable. Default
// off because each deep check costs network + a tiny bit of API quota.
//
// Output shape (200 always — caller decides what to alert on):
//   {
//     ok: boolean,                    // every "core" var is present
//     ts: ISO timestamp,
//     categories: { core, voice, email, cron, billing },
//     flags: { RETRY_FAILED_STRUCTURING_ENABLED, ... },
//     deep?: {                                         // only when ?deep=1
//       anthropic: { ok, latency_ms, error_class? },
//       supabase:  { ok, latency_ms, error_class? }
//     }
//   }

interface CategoryReport {
  ok: boolean;
  vars: Record<string, boolean>;
}

interface DeepCheckResult {
  ok: boolean;
  latency_ms: number;
  /** Coarse error category — never the message text, which can leak
   *  internal hostnames or token fragments. */
  error_class?:
    | "auth"
    | "network"
    | "timeout"
    | "rate_limited"
    | "missing_env"
    | "unknown";
}

const DEEP_TIMEOUT_MS = 5000;

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

function classify(err: unknown): DeepCheckResult["error_class"] {
  if (err instanceof Error) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") {
      if (status === 401 || status === 403) return "auth";
      if (status === 429) return "rate_limited";
      if (status >= 500 && status < 600) return "network";
    }
    const msg = err.message.toLowerCase();
    if (msg.includes("aborted") || msg.includes("timeout"))
      return "timeout";
    if (
      msg.includes("network") ||
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("enotfound")
    )
      return "network";
  }
  return "unknown";
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEP_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function checkAnthropic(): Promise<DeepCheckResult> {
  if (!present("ANTHROPIC_API_KEY")) {
    return { ok: false, latency_ms: 0, error_class: "missing_env" };
  }
  const start = Date.now();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await withTimeout((signal) => client.models.list({}, { signal }));
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error_class: classify(err),
    };
  }
}

async function checkSupabase(): Promise<DeepCheckResult> {
  if (
    !present("NEXT_PUBLIC_SUPABASE_URL") ||
    !present("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    return { ok: false, latency_ms: 0, error_class: "missing_env" };
  }
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    // Trivial query — confirms URL is reachable + service-role key is
    // valid. organizations exists in every deployment.
    // PostgrestFilterBuilder is thenable but not a Promise, so we wrap
    // in an async fn to satisfy withTimeout's signature.
    const result = (await withTimeout(async () =>
      supabase.from("organizations").select("id", { head: true, count: "exact" })
    )) as { error: { code?: string; message?: string } | null };
    if (result.error) {
      const { code, message } = result.error;
      return {
        ok: false,
        latency_ms: Date.now() - start,
        error_class:
          (code === "42P01" && "missing_env") ||
          (message?.toLowerCase().includes("jwt") && "auth") ||
          "unknown",
      };
    }
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error_class: classify(err),
    };
  }
}

export async function GET(request: NextRequest) {
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

  const wantDeep = request.nextUrl.searchParams.get("deep") === "1";
  let deep:
    | { anthropic: DeepCheckResult; supabase: DeepCheckResult }
    | undefined;
  if (wantDeep) {
    const [anthropicResult, supabaseResult] = await Promise.all([
      checkAnthropic(),
      checkSupabase(),
    ]);
    deep = { anthropic: anthropicResult, supabase: supabaseResult };
  }

  return NextResponse.json({
    ok: categories.core.ok,
    ts: new Date().toISOString(),
    categories,
    flags,
    ...(deep ? { deep } : {}),
  });
}
