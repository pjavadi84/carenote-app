import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

// POST /api/residents/[id]/restore — undo a soft-delete. Only acts on
// residents currently in deleted_pending; everything else is a no-op that
// returns 404 so the caller doesn't accidentally clobber a legitimate
// discharged / deceased status.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("residents")
    .update({ status: "active" })
    .eq("id", id)
    .eq("status", "deleted_pending")
    .select("id, organization_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to restore", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Resident not found or not in deleted_pending state" },
      { status: 404 }
    );
  }

  const typed = data as { id: string; organization_id: string };

  await logAudit({
    organizationId: typed.organization_id,
    userId: user.id,
    eventType: "permission_change",
    objectType: "resident",
    objectId: typed.id,
    request,
    metadata: { action: "restore", to_status: "active" },
  });

  return NextResponse.json({ success: true });
}
