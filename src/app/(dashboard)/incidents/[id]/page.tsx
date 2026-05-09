import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IncidentActions } from "@/components/incidents/incident-actions";
import { MandatoryReportSection } from "@/components/incidents/mandatory-report-section";
import {
  AIDisclosure,
  AI_DISCLOSURE_INCIDENT,
} from "@/components/transparency/ai-disclosure";
import { format } from "date-fns";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("incident_reports")
    .select("*, residents(first_name, last_name), notes(raw_input, created_at)")
    .eq("id", id)
    .eq("organization_id", user.organization_id)
    .single();

  if (!data) notFound();

  const incident = data as {
    id: string;
    report_text: string;
    incident_type: string;
    severity: string;
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    manager_notes: string | null;
    family_notified: boolean;
    family_notified_at: string | null;
    follow_up_date: string | null;
    created_at: string;
    mandatory_report_required: boolean | null;
    mandatory_report_authority: string | null;
    mandatory_report_deadline_at: string | null;
    mandatory_report_legal_basis: string | null;
    mandatory_report_submitted_at: string | null;
    mandatory_report_submitted_by: string | null;
    mandatory_report_method: string | null;
    mandatory_report_reference: string | null;
    mandatory_report_notes: string | null;
    residents: { first_name: string; last_name: string } | null;
    notes: { raw_input: string; created_at: string } | null;
  };

  // Resolve submitter name in a separate query — Supabase's type
  // inference doesn't auto-discover the FK relation here.
  let submitterName: string | null = null;
  if (incident.mandatory_report_submitted_by) {
    const { data: sub } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", incident.mandatory_report_submitted_by)
      .single();
    submitterName = (sub as { full_name: string } | null)?.full_name ?? null;
  }

  const reportData = parseReport(incident.report_text);

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">
          Incident Report — {incident.residents?.first_name}{" "}
          {incident.residents?.last_name}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant={
              incident.severity === "high"
                ? "destructive"
                : incident.severity === "medium"
                ? "default"
                : "secondary"
            }
            className="capitalize"
          >
            {incident.severity}
          </Badge>
          <Badge
            variant={incident.status === "open" ? "outline" : "secondary"}
            className="capitalize"
          >
            {incident.status}
          </Badge>
          <span className="text-sm text-muted-foreground capitalize">
            {incident.incident_type.replace("_", " ")}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(new Date(incident.created_at), "MMM d, yyyy h:mm a")}
          </span>
        </div>
      </div>

      {/* Original caregiver note */}
      {incident.notes && (
        <div className="mb-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Original Caregiver Note
          </p>
          <p className="text-sm">{incident.notes.raw_input}</p>
        </div>
      )}

      <Separator className="my-4" />

      {/* AI-generated report */}
      {reportData && (
        <div className="space-y-4 mb-6">
          <AIDisclosure message={AI_DISCLOSURE_INCIDENT} />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Description
            </p>
            <p className="text-sm">{reportData.description}</p>
          </div>

          {reportData.immediate_actions?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Immediate Actions
              </p>
              <ul className="text-sm list-disc list-inside">
                {reportData.immediate_actions.map((action: string, i: number) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Injuries Observed
            </p>
            <p className="text-sm">{reportData.injuries_observed}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Current Status
            </p>
            <p className="text-sm">{reportData.current_resident_status}</p>
          </div>

          {reportData.follow_up_recommended?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Follow-up Recommended
              </p>
              <ul className="text-sm list-disc list-inside">
                {reportData.follow_up_recommended.map(
                  (item: string, i: number) => (
                    <li key={i}>{item}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <Separator className="my-4" />

      {/* Statutory mandatory-reporting tracker — appears only when the
          classifier flagged this incident at create time. */}
      <MandatoryReportSection
        incidentId={incident.id}
        row={incident}
        submitterName={submitterName}
      />

      <Separator className="my-4" />

      {/* Admin actions */}
      <IncidentActions incident={incident} />
    </div>
  );
}

function parseReport(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
