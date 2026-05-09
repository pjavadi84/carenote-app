"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Loader2, ShieldCheck } from "lucide-react";

const PAPER_LOCALES = [
  { value: "id", label: "Indonesian (id)" },
  { value: "vi", label: "Vietnamese (vi)" },
  { value: "tl", label: "Tagalog (tl)" },
  { value: "zh-TW", label: "Mandarin (zh-TW)" },
  { value: "en", label: "English (en)" },
];

/**
 * Admin-facing button that records standing PDPA consent for a caregiver.
 *
 * For caregivers whose primary language is id/vi/tl (the typical Taiwan
 * elder-care workforce), the binding consent must be signed on paper in
 * their native language — the May 2026 brief explicitly bans
 * LLM-translated consent. This dialog records the standing
 * acknowledgment as an audit anchor pointing at the paper original.
 *
 * For en/zh-TW caregivers, an equivalent self-ack flow exists at
 * /api/pdpa/caregiver-consents (mode=self_ack) but isn't surfaced here —
 * admins shouldn't self-ack on behalf of someone who can use the app.
 */
export function CaregiverConsentButton({
  caregiverUserId,
  caregiverName,
  hasActiveConsent,
}: {
  caregiverUserId: string;
  caregiverName: string;
  hasActiveConsent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locale, setLocale] = useState("id");
  const [paperReference, setPaperReference] = useState("");
  const [consentVersion, setConsentVersion] = useState("");

  async function handleSubmit() {
    if (!paperReference.trim()) {
      toast.error("Provide a paper reference (where the original is filed)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pdpa/caregiver-consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "paper",
          caregiverUserId,
          locale,
          paperReference: paperReference.trim(),
          consentVersion: consentVersion.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to record consent");
        return;
      }
      toast.success("Paper consent recorded");
      setOpen(false);
      setPaperReference("");
      setConsentVersion("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant={hasActiveConsent ? "outline" : "default"}
          />
        }
      >
        {hasActiveConsent ? (
          <>
            <ShieldCheck className="h-3 w-3 mr-1" />
            PDPA on file
          </>
        ) : (
          "Record PDPA"
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Record paper PDPA consent — {caregiverName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Records that this caregiver signed paper PDPA consent in their
            native language. The paper original must be filed per Taiwan
            labor law; this entry is the audit anchor.
          </p>

          <div className="space-y-1">
            <Label>Paper consent language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Paper reference (where the original is filed)</Label>
            <Input
              value={paperReference}
              onChange={(e) => setPaperReference(e.target.value)}
              placeholder="e.g., HR cabinet 3, folder Indonesian-2026, page 14"
            />
          </div>

          <div className="space-y-1">
            <Label>
              Paper version (optional — defaults to{" "}
              <code>paper-{locale}</code>)
            </Label>
            <Input
              value={consentVersion}
              onChange={(e) => setConsentVersion(e.target.value)}
              placeholder={`paper-v1-${locale}`}
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
              "Record paper consent"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
