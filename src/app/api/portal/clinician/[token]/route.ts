import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { checkRate } from "@/lib/rate-limit";

// 10 opens per minute per token handles legitimate refresh / reload; 60
// per minute per IP blocks a bot brute-forcing random token strings.
// Tokens are 256 bits so the brute force is mostly academic, but the
// per-IP cap also prevents credential-stuffing against the endpoint.
const TOKEN_LIMIT_MAX = 10;
const TOKEN_LIMIT_WINDOW_MS = 60_000;
const IP_LIMIT_MAX = 60;
const IP_LIMIT_WINDOW_MS = 60_000;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfter = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": retryAfter.toString() } }
  );
}

// Unauthenticated endpoint. Uses the service-role client because clinicians
// don't have accounts — the magic-link token IS the auth. Validates the
// token, records the open event, and returns the frozen rendered summary.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Rate limit by token and by IP before we do any DB work. A well-behaved
  // clinician refreshing the page falls well under both caps; anything
  // hammering either value is blocked cheaply.
  const ip = clientIp(request);
  const byToken = checkRate(
    `portal:tok:${token}`,
    TOKEN_LIMIT_MAX,
    TOKEN_LIMIT_WINDOW_MS
  );
  if (!byToken.allowed) return rateLimitResponse(byToken.retryAfterMs);
  const byIp = checkRate(
    `portal:ip:${ip}`,
    IP_LIMIT_MAX,
    IP_LIMIT_WINDOW_MS
  );
  if (!byIp.allowed) return rateLimitResponse(byIp.retryAfterMs);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: shareRow } = await admin
    .from("clinician_share_links")
    .select(
      "id, organization_id, resident_id, clinician_id, rendered_summary, expires_at, revoked_at, first_opened_at, open_count"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const row = shareRow as {
    id: string;
    organization_id: string;
    resident_id: string;
    clinician_id: string;
    rendered_summary: Record<string, unknown>;
    expires_at: string;
    revoked_at: string | null;
    first_opened_at: string | null;
    open_count: number;
  } | null;

  if (!row) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (row.revoked_at) {
    return NextResponse.json(
      { error: "This link has been revoked" },
      { status: 410 }
    );
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This link has expired" },
      { status: 410 }
    );
  }

  // Record open. first_opened_at is set once; last_opened_at + open_count on
  // every access. Also write an audit_events row (no user_id — the portal
  // is unauthenticated; IP + UA identify the opener).
  const now = new Date().toISOString();
  await admin
    .from("clinician_share_links")
    .update({
      last_opened_at: now,
      first_opened_at: row.first_opened_at ?? now,
      open_count: row.open_count + 1,
    })
    .eq("id", row.id);

  await logAudit({
    organizationId: row.organization_id,
    userId: null,
    eventType: "share_open",
    objectType: "share_link",
    objectId: row.id,
    request,
    metadata: {
      clinician_id: row.clinician_id,
      resident_id: row.resident_id,
      open_count_after: row.open_count + 1,
      first_open: row.first_opened_at === null,
    },
  });

  // Resolve facility + resident + clinician display info for the portal view.
  const [{ data: org }, { data: resident }, { data: clinician }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", row.organization_id)
        .single(),
      admin
        .from("residents")
        .select("first_name, last_name, date_of_birth")
        .eq("id", row.resident_id)
        .single(),
      admin
        .from("clinicians")
        .select("full_name, specialty")
        .eq("id", row.clinician_id)
        .single(),
    ]);

  return NextResponse.json({
    facility_name: (org as { name: string } | null)?.name ?? "Care Facility",
    resident: resident as {
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
    } | null,
    clinician: clinician as {
      full_name: string;
      specialty: string | null;
    } | null,
    summary: row.rendered_summary,
    expires_at: row.expires_at,
  });
}
