import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evaluatePrompt } from "@/lib/lobster-trap";
import { logAudit } from "@/lib/audit";

// Admin-only endpoint that runs a candidate prompt through the
// Kinroster TypeScript mirror of the Lobster Trap policy. The
// canonical enforcement lives in the Go proxy (infra/lobster-trap/);
// this endpoint exists so the /security admin page can preview the
// decision and demo prompt-injection blocking live without spinning up
// the sidecar.
//
// Every inspection is recorded in audit_events so the security feed on
// /security shows real data, not a transient client-side log.

export async function POST(request: NextRequest) {
  const user = await requireAdmin();

  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  if (prompt.length > 4000) {
    return NextResponse.json(
      { error: "prompt too long (max 4000 chars)" },
      { status: 400 },
    );
  }

  const decision = evaluatePrompt(prompt);

  // Fire-and-forget audit write. logAudit swallows DB errors so a
  // schema-level rejection (e.g. missing event_type enum value) doesn't
  // break the demo path. The metadata.kind discriminator lets the
  // /security feed filter without needing a DB migration.
  await logAudit({
    organizationId: user.organization_id,
    userId: user.id,
    eventType: decision.finalAction === "DENY" ? "failed_access" : "export",
    result: decision.finalAction === "DENY" ? "denied" : "success",
    request,
    metadata: {
      kind:
        decision.finalAction === "DENY"
          ? "lobster_trap_block"
          : "lobster_trap_inspect",
      blocking_rule: decision.blockingRule?.name ?? null,
      matched_rules: decision.matches.map((m) => m.rule.name),
      prompt_preview: prompt.slice(0, 200),
    },
  });

  return NextResponse.json({
    decision: {
      finalAction: decision.finalAction,
      blockingRule: decision.blockingRule
        ? {
            name: decision.blockingRule.name,
            description: decision.blockingRule.description,
            denyMessage: decision.blockingRule.denyMessage ?? null,
            priority: decision.blockingRule.priority,
          }
        : null,
      matches: decision.matches.map((m) => ({
        name: m.rule.name,
        action: m.rule.action,
        priority: m.rule.priority,
        description: m.rule.description,
        excerpt: m.excerpt,
      })),
    },
  });
}
