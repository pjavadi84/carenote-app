"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Loader2, ShieldAlert } from "lucide-react";

type RecipientType =
  | "patient_or_guardian"
  | "other_facility"
  | "regulator"
  | "legal_request"
  | "agency_internal";

type Scope = "full" | "clinical_only" | "demographics_only";

const RECIPIENT_OPTIONS: Array<{
  value: RecipientType;
  label: string;
  hint: string;
}> = [
  {
    value: "patient_or_guardian",
    label: "Resident or guardian (portability)",
    hint: "Data subject is requesting their own record. PDPA Art. 10 / HIPAA right of access.",
  },
  {
    value: "other_facility",
    label: "Other facility (continuity of care)",
    hint: "Chart following the resident to a new residential or acute facility.",
  },
  {
    value: "regulator",
    label: "Regulator (audit / inspection)",
    hint: "Social welfare bureau, MoHW, or NHI request.",
  },
  {
    value: "legal_request",
    label: "Legal (subpoena / court order)",
    hint: "Attorney letter, subpoena, or court order. Verify the order before exporting.",
  },
  {
    value: "agency_internal",
    label: "Internal (backup / training)",
    hint: "Stays inside the org. Default for routine record-keeping.",
  },
];

const SCOPE_OPTIONS: Array<{ value: Scope; label: string; hint: string }> = [
  {
    value: "full",
    label: "Full record",
    hint: "Resident, family contacts, clinicians, notes, incidents, weekly summaries, family communications, disclosures, audit, voice.",
  },
  {
    value: "clinical_only",
    label: "Clinical only",
    hint: "Resident + clinicians + notes + incidents + weekly summaries + voice. Excludes family-side records.",
  },
  {
    value: "demographics_only",
    label: "Demographics only",
    hint: "Resident + family contacts. No clinical content.",
  },
];

export function ExportDialog({
  residentId,
  residentDisplay,
}: {
  residentId: string;
  residentDisplay: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recipientType, setRecipientType] =
    useState<RecipientType>("agency_internal");
  const [scope, setScope] = useState<Scope>("full");
  const [reason, setReason] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [redactIdentifiers, setRedactIdentifiers] = useState(false);

  function reset() {
    setRecipientType("agency_internal");
    setScope("full");
    setReason("");
    setRecipientName("");
    setRedactIdentifiers(false);
  }

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/residents/${residentId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          recipientType,
          scope,
          recipientName: recipientName.trim() || null,
          redactIdentifiers,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "Export failed.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "kinroster-resident-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Export downloaded and disclosure logged.");
      setOpen(false);
      setTimeout(reset, 200);
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const recipientHint = RECIPIENT_OPTIONS.find(
    (o) => o.value === recipientType
  )?.hint;
  const scopeHint = SCOPE_OPTIONS.find((o) => o.value === scope)?.hint;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="mr-1 h-3 w-3" />
        Export JSON
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export resident record — {residentDisplay}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              This download leaves Kinroster
            </p>
            <p className="text-muted-foreground">
              The export, your declared reason, and the recipient
              category will be written to the audit + disclosure ledgers.
              Daily limit: 10 exports per org per 24h.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Select
              value={recipientType}
              onValueChange={(v) => v && setRecipientType(v as RecipientType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recipientHint && (
              <p className="text-xs text-muted-foreground">{recipientHint}</p>
            )}
          </div>

          {recipientType !== "agency_internal" && (
            <div className="space-y-1.5">
              <Label>
                Recipient name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g., Sunrise Senior Care, Dr. Lin's clinic, Officer Chen"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => v && setScope(v as Scope)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scopeHint && (
              <p className="text-xs text-muted-foreground">{scopeHint}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Reason for export</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g., Resident transferring to St. Mary's; chart requested by receiving facility on 2026-05-09."
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters. Stored verbatim on the audit row.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={redactIdentifiers}
                onCheckedChange={(c) => setRedactIdentifiers(c === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">
                  Redact identifiers (PHI-safe export)
                </span>
                <span className="block text-xs text-muted-foreground font-normal">
                  Strips ROC ID / NHI / SSN / CCCD / NIK and postal addresses
                  from text fields, and replaces dates of birth with a 5-year
                  band. Clinical observations are preserved verbatim. Use for
                  billing, training, or non-clinical recipients.
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 10}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-1 h-3 w-3" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
