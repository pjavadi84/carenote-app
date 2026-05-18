import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LobsterTrapInspector } from "@/components/security/lobster-trap-inspector";

export const metadata: Metadata = {
  title: "Security",
};

type AuditRow = {
  id: string;
  created_at: string;
  event_type: string;
  result: string;
  metadata: Record<string, unknown> | null;
};

type LobsterMeta = {
  kind?: string;
  blocking_rule?: string | null;
  matched_rules?: string[];
  prompt_preview?: string;
};

export default async function SecurityPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Pull the most recent Lobster Trap inspections from the existing
  // audit ledger. We filter on metadata->>kind so this works regardless
  // of whether a new event_type enum has been added at the DB level.
  const { data: rawAudit } = await supabase
    .from("audit_events")
    .select("id, created_at, event_type, result, metadata")
    .eq("organization_id", user.organization_id)
    .or(
      "metadata->>kind.eq.lobster_trap_block,metadata->>kind.eq.lobster_trap_inspect",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const audit = (rawAudit ?? []) as AuditRow[];
  const blockedCount = audit.filter(
    (r) =>
      (r.metadata as LobsterMeta | null)?.kind === "lobster_trap_block",
  ).length;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <Badge variant="outline">Lobster Trap</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Inline policy enforcement on every LLM call. The rules below run
          in the Lobster Trap proxy (
          <Link
            href="https://github.com/veeainc/lobstertrap"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            github.com/veeainc/lobstertrap
          </Link>
          , MIT, Veea) and are mirrored in TypeScript so this page can
          preview decisions without a live sidecar. See{" "}
          <code className="rounded bg-muted px-1">
            docs/engineering/lobster-trap.md
          </code>{" "}
          for the integration and{" "}
          <code className="rounded bg-muted px-1">
            infra/lobster-trap/policy.yaml
          </code>{" "}
          for the canonical policy.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent inspections (last 20)</CardDescription>
            <CardTitle className="text-3xl">{audit.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blocked attempts</CardDescription>
            <CardTitle className="text-3xl">{blockedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Proxy status</CardDescription>
            <CardTitle className="text-3xl">
              {process.env.ANTHROPIC_BASE_URL ? "Live" : "Preview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {process.env.ANTHROPIC_BASE_URL
              ? "ANTHROPIC_BASE_URL is set; every Claude call routes through the proxy."
              : "ANTHROPIC_BASE_URL is unset. Inspections still run via the TypeScript mirror — start the sidecar to enforce in-line."}
          </CardContent>
        </Card>
      </div>

      <LobsterTrapInspector />

      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
          <CardDescription>
            Pulled from <code>audit_events</code> with{" "}
            <code>metadata.kind = lobster_trap_*</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inspections yet. Try one of the sample prompts above.
            </p>
          ) : (
            <ul className="space-y-2">
              {audit.map((row) => {
                const meta = (row.metadata ?? {}) as LobsterMeta;
                const blocked = meta.kind === "lobster_trap_block";
                return (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded border p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={blocked ? "destructive" : "secondary"}
                        >
                          {blocked ? "DENY" : "ALLOW"}
                        </Badge>
                        {meta.blocking_rule && (
                          <code className="text-xs">
                            {meta.blocking_rule}
                          </code>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </span>
                      </div>
                      {meta.prompt_preview && (
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {meta.prompt_preview}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
