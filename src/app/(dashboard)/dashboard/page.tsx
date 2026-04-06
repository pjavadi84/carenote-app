import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, Users, Clock } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const orgId = user.organization_id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parallel queries
  const [notesResult, incidentsResult, residentsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .gte("created_at", today.toISOString()),
    supabase
      .from("incident_reports")
      .select("id, severity, residents(first_name, last_name)", {
        count: "exact",
      })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    supabase
      .from("residents")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("status", "active"),
  ]);

  const notesTodayCount = notesResult.count ?? 0;
  const openIncidents = (incidentsResult.data ?? []) as Array<{
    id: string;
    severity: string;
    residents: { first_name: string; last_name: string } | null;
  }>;
  const activeResidents = (residentsResult.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;

  // Find residents without notes today
  const { data: residentsWithNotesData } = await supabase
    .from("notes")
    .select("resident_id")
    .eq("organization_id", orgId)
    .gte("created_at", today.toISOString());

  const residentsWithNotes = (residentsWithNotesData ?? []) as Array<{ resident_id: string }>;
  const residentsWithNotesIds = new Set(
    residentsWithNotes.map((n) => n.resident_id)
  );
  const residentsWithoutNotes = activeResidents.filter(
    (r) => !residentsWithNotesIds.has(r.id)
  );

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Dashboard</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{notesTodayCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Notes Today</p>
          </CardContent>
        </Card>

        <Card className={openIncidents.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  openIncidents.length > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              />
              <span className="text-2xl font-bold">{openIncidents.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Open Incidents</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{activeResidents.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active Residents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {residentsWithoutNotes.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No Notes Today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Open incidents */}
      {openIncidents.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Open Incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
              >
                <span className="text-sm">
                  {incident.residents?.first_name}{" "}
                  {incident.residents?.last_name}
                </span>
                <Badge
                  variant={
                    incident.severity === "high" ? "destructive" : "secondary"
                  }
                  className="capitalize"
                >
                  {incident.severity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Residents without notes */}
      {residentsWithoutNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Residents Without Notes Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {residentsWithoutNotes.map((r) => (
                <Badge key={r.id} variant="outline">
                  {r.first_name} {r.last_name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
