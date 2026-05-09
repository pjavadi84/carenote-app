import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { structureNote } from "@/lib/services/structure-note";
import { logAudit } from "@/lib/audit";

// Admin-only manual retry for a note that the auto-retry cron has given up on
// (or that an admin wants to re-run mid-pilot). Resets structuring_attempts
// and structuring_giving_up before calling the service so the note gets a
// fresh budget of MAX_STRUCTURING_ATTEMPTS attempts.
//
// Logs an audit row regardless of outcome so the action is reviewable. RLS
// already constrains the supabase client to the admin's org; the service
// then writes against that same client.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .single();

  const typedAppUser = appUser as
    | { organization_id: string; role: string }
    | null;
  if (!typedAppUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (
    typedAppUser.role !== "admin" &&
    typedAppUser.role !== "compliance_admin"
  ) {
    return NextResponse.json(
      { error: "Only admins can retry stuck notes" },
      { status: 403 }
    );
  }

  // Read the prior counter so the audit row records what we cleared. RLS on
  // notes constrains this to the admin's own org.
  const { data: noteRow } = await supabase
    .from("notes")
    .select("structuring_attempts, structuring_giving_up")
    .eq("id", noteId)
    .single();

  const previous = noteRow as
    | { structuring_attempts: number; structuring_giving_up: boolean }
    | null;
  if (!previous) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Reset counters so the service runs the note as a fresh attempt.
  await supabase
    .from("notes")
    .update({
      structuring_attempts: 0,
      structuring_giving_up: false,
      structuring_error: null,
    })
    .eq("id", noteId);

  const result = await structureNote(supabase, noteId);

  await logAudit({
    organizationId: typedAppUser.organization_id,
    userId: authUser.id,
    eventType: "note_retry_structuring",
    objectType: "note",
    objectId: noteId,
    request,
    result: result.success ? "success" : "error",
    metadata: {
      previous_attempts: previous.structuring_attempts,
      previous_giving_up: previous.structuring_giving_up,
      retry_succeeded: result.success,
      retry_error: result.error ?? null,
    },
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Retry failed",
        details: result.error,
        gave_up: result.gaveUp,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
