"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, ShieldX } from "lucide-react";
import type { ResidentPdpaConsent } from "@/types/database";

type ConsentingPartyType = "resident" | "personal_representative";

export function PdpaConsentManager({
  residentId,
  residentName,
  consents,
  consentPreview,
  consentTextVersion,
}: {
  residentId: string;
  residentName: string;
  consents: ResidentPdpaConsent[];
  consentPreview: string;
  consentTextVersion: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [partyType, setPartyType] =
    useState<ConsentingPartyType>("personal_representative");
  const [partyName, setPartyName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const [signedTypedName, setSignedTypedName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const activeConsent = consents.find((c) => c.withdrawn_at == null) ?? null;

  async function handleCapture() {
    if (!partyName.trim() || !signedTypedName.trim() || !acknowledged) {
      toast.error("Fill name, signature, and check the acknowledgment box");
      return;
    }
    if (
      partyType === "personal_representative" &&
      !relationship.trim()
    ) {
      toast.error("Personal representative must declare relationship");
      return;
    }
    if (idLast4 && !/^\d{4}$/.test(idLast4)) {
      toast.error("ID last 4 must be exactly 4 digits");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pdpa/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentId,
          consentingPartyType: partyType,
          consentingPartyName: partyName.trim(),
          consentingPartyRelationship: relationship.trim() || null,
          consentingPartyIdLast4: idLast4 || null,
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
      router.refresh();
      setPartyName("");
      setRelationship("");
      setIdLast4("");
      setSignedTypedName("");
      setAcknowledged(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw(consentId: string) {
    const reason = window.prompt(
      "Reason for withdrawal (will be recorded in the audit log):"
    );
    if (!reason?.trim()) return;
    const res = await fetch(`/api/pdpa/consents/${consentId}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to withdraw");
      return;
    }
    toast.success("Consent withdrawn");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-3 space-y-2">
        <h3 className="font-medium text-sm flex items-center gap-2">
          {activeConsent ? (
            <>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Active consent on file
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
              No active consent
            </>
          )}
        </h3>
        {activeConsent ? (
          <div className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Consented by</span>
            <span>
              {activeConsent.consenting_party_name}{" "}
              <Badge variant="outline" className="text-xs">
                {activeConsent.consenting_party_type === "resident"
                  ? "Resident"
                  : `Personal rep · ${activeConsent.consenting_party_relationship ?? "—"}`}
              </Badge>
            </span>
            <span className="text-muted-foreground">Captured</span>
            <span>{new Date(activeConsent.consented_at).toLocaleString()}</span>
            <span className="text-muted-foreground">Text version</span>
            <span>
              <code>{activeConsent.consent_text_version}</code>{" "}
              {!activeConsent.attorney_reviewed && (
                <span className="text-amber-700">(provisional)</span>
              )}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Capture a consent record below before processing this
            resident&apos;s data through any AI-assisted surface.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium text-sm">Consent text the party will read</h3>
        <pre className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-sans max-h-64 overflow-auto">
          {consentPreview}
        </pre>
        <p className="text-xs text-muted-foreground">
          Version <code>{consentTextVersion}</code>. The exact rendered
          text above is what will be stored on the consent record.
        </p>
      </section>

      <section className="space-y-3 rounded-md border p-3">
        <h3 className="font-medium text-sm">Capture new consent</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Consenting party</Label>
            <Select
              value={partyType}
              onValueChange={(v) =>
                v && setPartyType(v as ConsentingPartyType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">
                  Resident (signing for themselves)
                </SelectItem>
                <SelectItem value="personal_representative">
                  Personal representative
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder={
                partyType === "resident" ? residentName : "e.g., 陳大華"
              }
            />
          </div>
        </div>

        {partyType === "personal_representative" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Relationship to resident</Label>
              <Input
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g., 子, 女, 法定代理人"
              />
            </div>
            <div className="space-y-1">
              <Label>ID last 4 (optional)</Label>
              <Input
                value={idLast4}
                onChange={(e) =>
                  setIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="4 digits"
                maxLength={4}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label>Signature (typed full name)</Label>
          <Input
            value={signedTypedName}
            onChange={(e) => setSignedTypedName(e.target.value)}
            placeholder="Type the consenting party's full name"
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="ack"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
          />
          <Label
            htmlFor="ack"
            className="text-xs leading-relaxed font-normal cursor-pointer"
          >
            I confirm the consenting party has read the consent text above
            and provided informed assent. I am capturing this record on
            their behalf and will be named as the capturing user in the
            audit log.
          </Label>
        </div>

        <Button
          onClick={handleCapture}
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
      </section>

      <section className="space-y-2">
        <h3 className="font-medium text-sm">All consent records</h3>
        {consents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No records yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {consents.map((c) => (
              <li
                key={c.id}
                className="rounded-md border p-3 text-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {c.consenting_party_name}{" "}
                    <Badge variant="outline" className="text-xs">
                      {c.consenting_party_type === "resident"
                        ? "Resident"
                        : `Personal rep · ${c.consenting_party_relationship ?? "—"}`}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">
                    Captured {new Date(c.consented_at).toLocaleString()} ·
                    version <code>{c.consent_text_version}</code> ·{" "}
                    {c.consent_text_locale}
                    {!c.attorney_reviewed && (
                      <span className="text-amber-700">
                        {" "}
                        · provisional
                      </span>
                    )}
                  </p>
                  {c.withdrawn_at && (
                    <p className="text-destructive flex items-center gap-1">
                      <ShieldX className="h-3 w-3" />
                      Withdrawn{" "}
                      {new Date(c.withdrawn_at).toLocaleString()} —{" "}
                      {c.withdrawal_reason}
                    </p>
                  )}
                </div>
                {!c.withdrawn_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleWithdraw(c.id)}
                  >
                    Withdraw
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
