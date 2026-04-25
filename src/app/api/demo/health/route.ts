import { NextResponse } from "next/server";
import { isDemoActive, getDemo } from "@/lib/demos/registry";

// Public, unauthenticated readiness check for the landing-page demo.
// Returns enough detail to diagnose "Demo is not configured." and "Demo is
// temporarily disabled." in production without exposing key values.
// Mirrors the gating order in src/app/api/demo/consult/route.ts.

export async function GET() {
  const demo = getDemo("consult");
  const registryActive = isDemoActive("consult");
  const killSwitchOff = process.env.DEMO_CONSULT_DISABLED !== "true";
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const ready = registryActive && killSwitchOff && openaiKey && anthropicKey;

  return NextResponse.json(
    {
      ready,
      checks: {
        registry_active: registryActive,
        kill_switch_disabled: killSwitchOff,
        openai_api_key_set: openaiKey,
        anthropic_api_key_set: anthropicKey,
      },
      registry: {
        status: demo?.status ?? "unknown",
        active_version_id: demo?.activeVersionId ?? null,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
