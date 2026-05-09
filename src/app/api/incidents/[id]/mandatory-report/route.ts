import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

interface FilingBody {
  /** ISO timestamp when the report was actually filed with the authority. */
  submittedAt: string;
  /** "online_portal" | "fax" | "in_person" | "email" | "phone" — free-text. */
  method: string;
  /** Authority's case / receipt number. */
  reference: string;
  notes?: string;
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
  // Filing a statutory report is the responsible person's regulatory
  // act; admin-only mirrors the same gate as PDPA consent capture.
  if (typedUser.role !== "admin" && typedUser.role !== "compliance_admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: FilingBody;
  try {
    body = (await request.json()) as FilingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.submittedAt || !body.method?.trim() || !body.reference?.trim()) {
    return NextResponse.json(
      { error: "submittedAt, method, and reference are required" },
      { status: 400 }
    );
  }
  if (Number.isNaN(new Date(body.submittedAt).getTime())) {
    return NextResponse.json(
      { error: "submittedAt must be a valid ISO timestamp" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("incident_reports")
    .select(
      "id, organization_id, mandatory_report_required, mandatory_report_submitted_at"
    )
    .eq("id", id)
    .single();
  const typedExisting = existing as
    | {
        id: string;
        organization_id: string;
        mandatory_report_required: boolean | null;
        mandatory_report_submitted_at: string | null;
      }
    | null;
  if (!typedExisting) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  if (typedExisting.organization_id !== typedUser.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!typedExisting.mandatory_report_required) {
    return NextResponse.json(
      {
        error:
          "This incident is not flagged as requiring statutory reporting.",
      },
      { status: 409 }
    );
  }
  if (typedExisting.mandatory_report_submitted_at) {
    return NextResponse.json(
      { error: "A filing has already been recorded for this incident." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("incident_reports")
    .update({
      mandatory_report_submitted_at: body.submittedAt,
      mandatory_report_submitted_by: user.id,
      mandatory_report_method: body.method.trim(),
      mandatory_report_reference: body.reference.trim(),
      mandatory_report_notes: body.notes?.trim() || null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      {
        error: "Failed to record filing",
        details: updateError.message,
      },
      { status: 500 }
    );
  }

  await logAudit({
    organizationId: typedUser.organization_id,
    userId: user.id,
    eventType: "mandatory_report_filed",
    objectType: "incident_report",
    objectId: id,
    request,
    metadata: {
      submitted_at: body.submittedAt,
      method: body.method.trim(),
      reference: body.reference.trim(),
    },
  });

  return NextResponse.json({ success: true });
}
