import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/claude";
import {
  INCIDENT_REPORT_SYSTEM_PROMPT,
  buildIncidentReportUserPrompt,
  type IncidentReportOutput,
} from "@/lib/prompts/incident-report";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await request.json();
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  // Fetch note with resident and author
  const { data: note } = await supabase
    .from("notes")
    .select("*, residents(first_name, last_name, conditions)")
    .eq("id", noteId)
    .single();

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const { data: author } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", note.author_id)
    .single();

  const resident = note.residents as {
    first_name: string;
    last_name: string;
    conditions: string | null;
  } | null;

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  try {
    const raw = await callClaude({
      systemPrompt: INCIDENT_REPORT_SYSTEM_PROMPT,
      userPrompt: buildIncidentReportUserPrompt({
        residentFirstName: resident.first_name,
        residentLastName: resident.last_name,
        conditions: resident.conditions,
        timestamp: note.created_at,
        caregiverName: (author as { full_name: string } | null)?.full_name || "Unknown",
        rawInput: note.raw_input,
      }),
      maxTokens: 1500,
    });

    const report = parseJsonResponse<IncidentReportOutput>(raw);

    // Create incident report record
    const { data: incidentReport, error } = await supabase
      .from("incident_reports")
      .insert({
        note_id: noteId,
        organization_id: note.organization_id,
        resident_id: note.resident_id,
        report_text: JSON.stringify(report),
        incident_type: report.incident_type,
        severity: determineSeverity(report),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save incident report" },
        { status: 500 }
      );
    }

    // Mark the note as incident-flagged
    await supabase
      .from("notes")
      .update({ flagged_as_incident: true })
      .eq("id", noteId);

    return NextResponse.json({ report, incidentReport });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate incident report", details: message },
      { status: 500 }
    );
  }
}

function determineSeverity(report: IncidentReportOutput): "low" | "medium" | "high" {
  const highTypes = ["fall", "elopement", "injury"];
  const mediumTypes = ["near_fall", "medication_error", "behavioral"];

  if (highTypes.includes(report.incident_type)) return "high";
  if (mediumTypes.includes(report.incident_type)) return "medium";

  // Check notifications for severity signals
  if (
    report.notifications_needed.licensing_agency === true ||
    report.notifications_needed.licensing_agency === "true"
  ) {
    return "high";
  }
  if (
    report.notifications_needed.physician === true ||
    report.notifications_needed.physician === "true"
  ) {
    return "medium";
  }

  return "low";
}
