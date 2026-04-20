import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

// DELETE /api/residents/[id] is soft-delete. Sets status=deleted_pending so
// the admin has a chance to undo. A separate Purge endpoint cascade-deletes.
export async function DELETE(
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

  // RLS enforces admin-only UPDATE, and we only flip to deleted_pending
  // from active/discharged/deceased. A caller who shouldn't be doing this
  // sees 0 rows updated and we translate that to 404.
  const { data, error } = await supabase
    .from("residents")
    .update({ status: "deleted_pending" })
    .eq("id", id)
    .neq("status", "deleted_pending")
    .select("id, organization_id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to mark for deletion", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Resident not found or already marked for deletion" },
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
    metadata: { action: "soft_delete", to_status: "deleted_pending" },
  });

  return NextResponse.json({ success: true });
}
