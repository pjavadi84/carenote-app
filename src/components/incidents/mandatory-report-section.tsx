"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import {
  authorityLabel,
  isOverdue,
  type MandatoryReportingAuthority,
} from "@/lib/incidents/mandatory-reporting";

export interface MandatoryReportRow {
  mandatory_report_required: boolean | null;
  mandatory_report_authority: MandatoryReportingAuthority | string | null;
  mandatory_report_deadline_at: string | null;
  mandatory_report_legal_basis: string | null;
  mandatory_report_submitted_at: string | null;
  mandatory_report_submitted_by: string | null;
  mandatory_report_method: string | null;
  mandatory_report_reference: string | null;
  mandatory_report_notes: string | null;
}

export function MandatoryReportSection({
  incidentId,
  row,
  submitterName,
}: {
  incidentId: string;
  row: MandatoryReportRow;
  /** Already-resolved name of the user who filed (server-side join). */
  submitterName: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(
    new Date().toISOString().slice(0, 16) // local-datetime input
  );
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Hide entirely for incidents not flagged. The classifier short-
  // circuits to false for non-pdpa_tw orgs, so this section won't
  // appear there.
  if (row.mandatory_report_required !== true) {
    return null;
  }

  const overdue = isOverdue(row);
  const filed = row.mandatory_report_submitted_at != null;

  async function handleSubmit() {
    if (!method.trim() || !reference.trim()) {
      toast.error("Filing method and authority reference number are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/incidents/${incidentId}/mandatory-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submittedAt: new Date(submittedAt).toISOString(),
            method: method.trim(),
            reference: reference.trim(),
            notes: notes.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to record filing");
        return;
      }
      toast.success("Filing recorded");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            {filed ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Statutory mandatory report — filed
              </>
            ) : overdue ? (
              <>
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Statutory mandatory report — OVERDUE
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-amber-600" />
                Statutory mandatory report — pending
              </>
            )}
          </h3>
          {row.mandatory_report_legal_basis && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Basis: {row.mandatory_report_legal_basis}
            </p>
          )}
        </div>
        {row.mandatory_report_authority && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {authorityLabel(
              row.mandatory_report_authority as MandatoryReportingAuthority
            )}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {row.mandatory_report_deadline_at && (
          <>
            <span className="text-muted-foreground">Deadline</span>
            <span className={overdue && !filed ? "text-destructive font-medium" : ""}>
              {new Date(row.mandatory_report_deadline_at).toLocaleString()}
            </span>
          </>
        )}
        {filed && (
          <>
            <span className="text-muted-foreground">Filed</span>
            <span>
              {new Date(row.mandatory_report_submitted_at!).toLocaleString()}
              {submitterName && ` · ${submitterName}`}
            </span>
            <span className="text-muted-foreground">Method</span>
            <span>{row.mandatory_report_method ?? "—"}</span>
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono">
              {row.mandatory_report_reference ?? "—"}
            </span>
            {row.mandatory_report_notes && (
              <>
                <span className="text-muted-foreground">Notes</span>
                <span className="whitespace-pre-wrap">
                  {row.mandatory_report_notes}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {!filed && (
        <div className="space-y-2 pt-2 border-t border-amber-500/20">
          <p className="text-xs text-muted-foreground">
            File the report with the authority via their channel (online
            portal / fax / in person), then record the receipt below.
            Kinroster does not submit reports — this is the audit anchor.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Filed at</Label>
              <Input
                type="datetime-local"
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="online_portal / fax / in_person / email"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Authority reference / case number</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g., SWB-2026-0512-0341"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional context for the audit log"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              "Record filing"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
