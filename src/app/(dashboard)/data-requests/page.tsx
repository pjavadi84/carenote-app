import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeletionActions } from "@/components/data-requests/deletion-actions";

export default async function DataRequestsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const [{ data: pendingData }, { data: ledgerData }] = await Promise.all([
    supabase
      .from("residents")
      .select("id, first_name, last_name, room_number, updated_at")
      .eq("organization_id", user.organization_id)
      .eq("status", "deleted_pending")
      .order("updated_at", { ascending: false }),
    supabase
      .from("deletion_ledger")
      .select("id, resident_name_hash, previous_status, deleted_at, deleted_by, reason")
      .eq("organization_id", user.organization_id)
      .order("deleted_at", { ascending: false })
      .limit(100),
  ]);

  const pending = (pendingData ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    room_number: string | null;
    updated_at: string;
  }>;

  const ledger = (ledgerData ?? []) as Array<{
    id: string;
    resident_name_hash: string;
    previous_status: string;
    deleted_at: string;
    deleted_by: string | null;
    reason: string;
  }>;

  // Deleter display names — we need one extra lookup to map user_id → name
  const deleterIds = [
    ...new Set(
      ledger
        .map((l) => l.deleted_by)
        .filter((v): v is string => typeof v === "string")
    ),
  ];

  let deleterMap = new Map<string, string>();
  if (deleterIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", deleterIds);
    deleterMap = new Map(
      ((users ?? []) as Array<{ id: string; full_name: string; email: string }>).map(
        (u) => [u.id, u.full_name || u.email]
      )
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Data Requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export a resident&apos;s full record for portability, and manage
          pending deletions. Soft-deleted residents can be restored until
          you explicitly purge them. The purge ledger below is append-only.
        </p>
      </div>

      <section className="mb-8">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Pending deletion
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No residents marked for deletion.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.room_number ? `Room ${r.room_number} · ` : ""}
                        <span suppressHydrationWarning>
                          marked {new Date(r.updated_at).toLocaleString()}
                        </span>
                      </p>
                    </div>
                    <DeletionActions residentId={r.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Purge ledger
        </h3>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No purges recorded.
          </p>
        ) : (
          <div className="space-y-2">
            {ledger.map((l) => (
              <Card key={l.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-mono text-muted-foreground">
                          {l.resident_name_hash.slice(0, 16)}…
                        </p>
                        <Badge variant="outline" className="text-xs">
                          from {l.previous_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Purged by{" "}
                        {l.deleted_by
                          ? deleterMap.get(l.deleted_by) ?? "deleted user"
                          : "unknown"}{" "}
                        ·{" "}
                        <span suppressHydrationWarning>
                          {new Date(l.deleted_at).toLocaleString()}
                        </span>
                      </p>
                      <p className="text-xs mt-1.5">
                        <span className="text-muted-foreground">Reason:</span>{" "}
                        {l.reason}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
