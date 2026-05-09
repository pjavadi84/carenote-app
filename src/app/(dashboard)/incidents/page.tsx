import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { isOverdue } from "@/lib/incidents/mandatory-reporting";

export default async function IncidentsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("incident_reports")
    .select("*, residents(first_name, last_name)")
    .eq("organization_id", user.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const incidents = (data ?? []) as Array<{
    id: string;
    incident_type: string;
    severity: string;
    status: string;
    created_at: string;
    mandatory_report_required: boolean | null;
    mandatory_report_deadline_at: string | null;
    mandatory_report_submitted_at: string | null;
    residents: { first_name: string; last_name: string } | null;
  }>;

  // Statutory-reporting summary across all org incidents (not just the
  // last 50 shown below). Drives the alert strip at top.
  const { count: totalPending } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organization_id)
    .eq("mandatory_report_required", true)
    .is("mandatory_report_submitted_at", null);

  const { count: totalOverdue } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organization_id)
    .eq("mandatory_report_required", true)
    .is("mandatory_report_submitted_at", null)
    .lt("mandatory_report_deadline_at", new Date().toISOString());

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Incidents</h2>

      {(totalPending ?? 0) > 0 && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            (totalOverdue ?? 0) > 0
              ? "border-destructive/40 bg-destructive/10"
              : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"
          }`}
        >
          <p className="font-medium flex items-center gap-2">
            {(totalOverdue ?? 0) > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Clock className="h-4 w-4 text-amber-600" />
            )}
            Statutory mandatory reporting:{" "}
            {totalPending} pending
            {(totalOverdue ?? 0) > 0 && ` · ${totalOverdue} overdue`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click an incident below with the warning badge to file the
            report and record the authority&apos;s receipt.
          </p>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No incidents recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <Link key={incident.id} href={`/incidents/${incident.id}`}>
              <Card
                className={`transition-colors hover:bg-accent/50 ${
                  incident.status === "open" ? "border-destructive/30" : ""
                }`}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">
                      {incident.residents?.first_name}{" "}
                      {incident.residents?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {incident.incident_type.replace("_", " ")} &middot;{" "}
                      {formatDistanceToNow(new Date(incident.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {incident.mandatory_report_required &&
                      !incident.mandatory_report_submitted_at && (
                        <Badge
                          variant={
                            isOverdue(incident) ? "destructive" : "default"
                          }
                          className="text-xs gap-1"
                        >
                          {isOverdue(incident) ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {isOverdue(incident) ? "report overdue" : "report due"}
                        </Badge>
                      )}
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
