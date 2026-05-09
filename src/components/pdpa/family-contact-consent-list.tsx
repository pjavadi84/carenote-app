"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export interface ContactConsentRow {
  id: string;
  name: string;
  relationship: string;
  email: string | null;
  activeConsentId: string | null;
  activeConsentAt: string | null;
  attorneyReviewed: boolean;
}

export function FamilyContactConsentList({
  contacts,
  consentPreviewByContactId,
  consentTextVersion,
}: {
  contacts: ContactConsentRow[];
  /** Pre-rendered zh-TW consent snapshot per contact (server-rendered to
   *  guarantee what's shown == what gets stored). */
  consentPreviewByContactId: Record<string, string>;
  consentTextVersion: string;
}) {
  if (contacts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No family contacts on this resident yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {contacts.map((c) => (
        <li
          key={c.id}
          className="rounded-md border p-3 text-xs flex items-start justify-between gap-3"
        >
          <div className="space-y-0.5">
            <p className="font-medium flex items-center gap-2">
              {c.name}{" "}
              <Badge variant="outline" className="text-xs">
                {c.relationship}
              </Badge>
              {c.activeConsentId ? (
                <Badge className="text-xs gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  consented
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <ShieldOff className="h-3 w-3" />
                  no consent
                </Badge>
              )}
            </p>
            {c.email && (
              <p className="text-muted-foreground">{c.email}</p>
            )}
            {c.activeConsentAt && (
              <p className="text-muted-foreground">
                Consented{" "}
                {new Date(c.activeConsentAt).toLocaleString()}
                {!c.attorneyReviewed && (
                  <span className="text-amber-700"> · provisional</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {c.activeConsentId ? (
              <WithdrawButton consentId={c.activeConsentId} />
            ) : (
              <CaptureDialog
                contactId={c.id}
                contactName={c.name}
                preview={consentPreviewByContactId[c.id] ?? ""}
                consentTextVersion={consentTextVersion}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CaptureDialog({
  contactId,
  contactName,
  preview,
  consentTextVersion,
}: {
  contactId: string;
  contactName: string;
  preview: string;
  consentTextVersion: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [partyName, setPartyName] = useState(contactName);
  const [signedTypedName, setSignedTypedName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleSubmit() {
    if (!partyName.trim() || !signedTypedName.trim() || !acknowledged) {
      toast.error("Fill name, signature, and check the acknowledgment box");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pdpa/family-contact-consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyContactId: contactId,
          consentingPartyName: partyName.trim(),
          signedTypedName: signedTypedName.trim(),
          locale: "zh-TW",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to record consent");
        return;
      }
      toast.success("Consent recorded");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Capture consent
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Capture PDPA consent — {contactName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Consent text the contact will read
            </Label>
            <pre className="mt-1 rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-sans max-h-48 overflow-auto">
              {preview}
            </pre>
            <p className="text-xs text-muted-foreground mt-1">
              Version <code>{consentTextVersion}</code>
            </p>
          </div>

          <div className="space-y-1">
            <Label>Consenting party (full name)</Label>
            <Input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Signature (typed full name)</Label>
            <Input
              value={signedTypedName}
              onChange={(e) => setSignedTypedName(e.target.value)}
              placeholder="Type the contact's full name"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id={`ack-${contactId}`}
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label
              htmlFor={`ack-${contactId}`}
              className="text-xs leading-relaxed font-normal cursor-pointer"
            >
              I confirm the family contact has read the consent text above
              and provided informed assent. I am capturing this record on
              their behalf and will be named as the capturing user in the
              audit log.
            </Label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !acknowledged}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              "Record consent"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawButton({ consentId }: { consentId: string }) {
  const router = useRouter();
  async function handle() {
    const reason = window.prompt(
      "Reason for withdrawal (will be recorded in the audit log):"
    );
    if (!reason?.trim()) return;
    const res = await fetch(
      `/api/pdpa/family-contact-consents/${consentId}/withdraw`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to withdraw");
      return;
    }
    toast.success("Consent withdrawn");
    router.refresh();
  }
  return (
    <Button size="sm" variant="outline" onClick={handle}>
      Withdraw
    </Button>
  );
}
