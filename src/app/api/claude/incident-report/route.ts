import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/claude";
import { redactPhiText } from "@/lib/redaction";
import { getResidentContext } from "@/lib/i18n/locale";
import {
  classifyMandatoryReporting,
  deadlineAt,
} from "@/lib/incidents/mandatory-reporting";
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

  const localeContext = await getResidentContext(note.resident_id);

  try {
    const raw = await callClaude({
      systemPrompt: INCIDENT_REPORT_SYSTEM_PROMPT,
      userPrompt: buildIncidentReportUserPrompt({
        residentFirstName: resident.first_name,
        residentLastName: resident.last_name,
        conditions: resident.conditions
          ? redactPhiText(resident.conditions)
          : null,
        timestamp: note.created_at,
        caregiverName: (author as { full_name: string } | null)?.full_name || "Unknown",
        rawInput: redactPhiText(note.raw_input),
        localeContext,
      }),
      maxTokens: 1500,
    });

    const report = parseJsonResponse<IncidentReportOutput>(raw);
    const severity = determineSeverity(report);

    // F4 #6 — classify whether this incident triggers Taiwan statutory
    // mandatory reporting. The classifier short-circuits to required=false
    // for non-pdpa_tw orgs, so this is a no-op for US/EU rows.
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("regulatory_region")
      .eq("id", note.organization_id)
      .single();
    const region =
      (orgRow as { regulatory_region: string | null } | null)
        ?.regulatory_region ?? null;

    const aiFlag = report.notifications_needed?.licensing_agency;
    const classification = classifyMandatoryReporting(
      {
        incidentType: report.incident_type,
        severity,
        aiFlaggedLicensingAgency:
          typeof aiFlag === "boolean"
            ? aiFlag
            : typeof aiFlag === "string"
              ? aiFlag.toLowerCase() === "true"
              : false,
        description: report.description,
      },
      region
    );

    const createdAtIso = new Date().toISOString();
    const deadlineIso = deadlineAt(classification, createdAtIso);

    // Create incident report record
    const { data: incidentReport, error } = await supabase
      .from("incident_reports")
      .insert({
        note_id: noteId,
        organization_id: note.organization_id,
        resident_id: note.resident_id,
        report_text: JSON.stringify(report),
        incident_type: report.incident_type,
        severity,
        mandatory_report_required: classification.required,
        mandatory_report_authority: classification.authority,
        mandatory_report_deadline_at: deadlineIso,
        mandatory_report_legal_basis: classification.legalBasis,
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
