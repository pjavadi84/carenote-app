import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
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

  const { data: session } = await supabase
    .from("voice_sessions")
    .select("id, status, note_id")
    .eq("id", id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const typedSession = session as { id: string; status: string; note_id: string | null };

  let noteStructured = false;
  let flaggedAsIncident = false;
  if (typedSession.note_id) {
    const { data: note } = await supabase
      .from("notes")
      .select("is_structured, flagged_as_incident")
      .eq("id", typedSession.note_id)
      .single();
    const typedNote = note as { is_structured: boolean; flagged_as_incident: boolean } | null;
    noteStructured = typedNote?.is_structured ?? false;
    flaggedAsIncident = typedNote?.flagged_as_incident ?? false;
  }

  return NextResponse.json({
    sessionId: typedSession.id,
    status: typedSession.status,
    noteId: typedSession.note_id,
    noteStructured,
    flaggedAsIncident,
  });
}
