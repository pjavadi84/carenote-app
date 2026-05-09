import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

interface WithdrawBody {
  reason: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  const typedUser = appUser as
    | { organization_id: string; role: string }
    | null;
  if (!typedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (typedUser.role !== "admin" && typedUser.role !== "compliance_admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: WithdrawBody;
  try {
    body = (await request.json()) as WithdrawBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json(
      { error: "Withdrawal reason required" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("resident_pdpa_consents")
    .select("id, organization_id, resident_id, withdrawn_at")
    .eq("id", id)
    .single();
  const typedExisting = existing as
    | {
        id: string;
        organization_id: string;
        resident_id: string;
        withdrawn_at: string | null;
      }
    | null;
  if (!typedExisting) {
    return NextResponse.json(
      { error: "Consent record not found" },
      { status: 404 }
    );
  }
  if (typedExisting.organization_id !== typedUser.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typedExisting.withdrawn_at) {
    return NextResponse.json(
      { error: "Consent already withdrawn" },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("resident_pdpa_consents")
    .update({
      withdrawn_at: new Date().toISOString(),
      withdrawn_by_user_id: user.id,
      withdrawal_reason: body.reason.trim(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to withdraw consent", details: updateError.message },
      { status: 500 }
    );
  }

  await logAudit({
    organizationId: typedUser.organization_id,
    userId: user.id,
    eventType: "pdpa_consent_withdraw",
    objectType: "pdpa_consent",
    objectId: id,
    request,
    metadata: {
      resident_id: typedExisting.resident_id,
      reason: body.reason.trim(),
    },
  });

  return NextResponse.json({ success: true });
}
