import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

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
    residents: { first_name: string; last_name: string } | null;
  }>;

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Incidents</h2>

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
