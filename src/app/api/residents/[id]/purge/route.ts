import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// POST /api/residents/[id]/purge — hard-deletes a resident marked
// deleted_pending. The resident must already be in the deleted_pending
// state (caught by the soft-delete flow) so a single admin mistake can't
// wipe a live chart. Requires an explicit reason.
//
// Writes a deletion_ledger row BEFORE the delete so if the cascade fails
// we still have the audit trail. The ledger stores only a SHA-256 hash
// of the resident's display name + dob so PHI doesn't persist past the
// delete.
//
// Everything referencing the resident cascades (notes, incidents, family
// contacts, voice sessions, disclosure_events, etc.) — that's the point
// of a purge. Historical disclosures to external recipients are lost,
// which is the right trade-off when an admin has explicitly decided the
// record should no longer exist. Routine retention of discharged /
// deceased residents should use the 'discharged' / 'deceased' status,
// not this endpoint.
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

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "Reason is required (minimum 5 characters)" },
      { status: 400 }
    );
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  const typedAppUser = appUser as {
    role: string;
    organization_id: string;
  } | null;

  if (
    !typedAppUser ||
    (typedAppUser.role !== "admin" && typedAppUser.role !== "compliance_admin")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: resident } = await supabase
    .from("residents")
    .select("id, organization_id, first_name, last_name, date_of_birth, status")
    .eq("id", id)
    .single();

  const typedResident = resident as {
    id: string;
    organization_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    status: string;
  } | null;

  if (!typedResident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  if (typedResident.status !== "deleted_pending") {
    return NextResponse.json(
      {
        error:
          "Resident must be in deleted_pending state before purging. Soft-delete first.",
      },
      { status: 400 }
    );
  }

  // SHA-256 of name + dob. Unsalted is intentional — the ledger is
  // supposed to support "has this person been purged before" lookups
  // without a lookup table.
  const nameHashInput = `${typedResident.first_name.toLowerCase()}|${typedResident.last_name.toLowerCase()}|${
    typedResident.date_of_birth ?? ""
  }`;
  const nameHash = crypto
    .createHash("sha256")
    .update(nameHashInput)
    .digest("hex");

  const admin = createAdminClient();

  // Write the ledger FIRST. If the cascade delete fails we still have
  // the evidence something was attempted; if it succeeds, the ledger is
  // the durable record.
  const { error: ledgerError } = await admin.from("deletion_ledger").insert({
    organization_id: typedResident.organization_id,
    resident_id: typedResident.id,
    resident_name_hash: nameHash,
    previous_status: typedResident.status,
    deleted_by: user.id,
    reason,
  });

  if (ledgerError) {
    return NextResponse.json(
      {
        error: "Failed to write deletion ledger",
        details: ledgerError.message,
      },
      { status: 500 }
    );
  }

  // Emit the audit event before the cascade so user_id + resident_id are
  // still valid FKs. audit_events.user_id is SET NULL on user delete
  // but there's no FK to residents, so the row survives.
  await logAudit({
    organizationId: typedResident.organization_id,
    userId: user.id,
    eventType: "permission_change",
    objectType: "resident",
    objectId: typedResident.id,
    request,
    metadata: {
      action: "purge",
      reason,
      resident_name_hash: nameHash,
    },
  });

  // Cascade delete. Uses admin client so we don't hit RLS UPDATE/DELETE
  // edge cases around the deleted_pending state.
  const { error: deleteError } = await admin
    .from("residents")
    .delete()
    .eq("id", typedResident.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to purge resident", details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
