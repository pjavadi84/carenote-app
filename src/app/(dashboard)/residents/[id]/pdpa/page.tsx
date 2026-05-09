import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import type { Resident, ResidentPdpaConsent } from "@/types/database";
import {
  ATTORNEY_REVIEWED,
  CONSENT_TEXT_VERSION,
  renderConsentText,
  renderFamilyContactConsentText,
} from "@/lib/pdpa/consent-text";
import { PdpaConsentManager } from "@/components/pdpa/pdpa-consent-manager";
import {
  FamilyContactConsentList,
  type ContactConsentRow,
} from "@/components/pdpa/family-contact-consent-list";

export default async function ResidentPdpaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: residentId } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: residentData } = await supabase
    .from("residents")
    .select("*")
    .eq("id", residentId)
    .eq("organization_id", user.organization_id)
    .single();
  const resident = residentData as Resident | null;
  if (!resident) notFound();

  const { data: consentsData } = await supabase
    .from("resident_pdpa_consents")
    .select("*")
    .eq("resident_id", residentId)
    .order("consented_at", { ascending: false });
  const consents = (consentsData ?? []) as ResidentPdpaConsent[];

  const { data: orgData } = await supabase
    .from("organizations")
    .select("name, email_reply_to")
    .eq("id", user.organization_id)
    .single();
  const typedOrg = orgData as
    | { name: string; email_reply_to: string | null }
    | null;

  // Pre-render the zh-TW snapshot so the admin sees what the consenting
  // party will read before they capture. Same renderer used server-side
  // when the consent is recorded — guarantees what's shown == what's
  // stored.
  const consentPreviewZhTw = renderConsentText(
    {
      orgName: typedOrg?.name ?? "Kinroster",
      dpoEmail: typedOrg?.email_reply_to ?? "privacy@kinroster.com",
      residentName: `${resident.first_name} ${resident.last_name}`.trim(),
    },
    "zh-TW"
  );

  // Family contacts on this resident + each contact's active consent.
  const { data: contactsData } = await supabase
    .from("family_contacts")
    .select("id, name, relationship, email")
    .eq("resident_id", residentId);
  const contactRows = (contactsData ?? []) as Array<{
    id: string;
    name: string;
    relationship: string;
    email: string | null;
  }>;

  let activeContactConsents: Array<{
    id: string;
    family_contact_id: string;
    consented_at: string;
    attorney_reviewed: boolean;
  }> = [];
  if (contactRows.length > 0) {
    const { data: consentRows } = await supabase
      .from("family_contact_pdpa_consents")
      .select("id, family_contact_id, consented_at, attorney_reviewed")
      .in(
        "family_contact_id",
        contactRows.map((c) => c.id)
      )
      .is("withdrawn_at", null)
      .order("consented_at", { ascending: false });
    activeContactConsents = (consentRows ?? []) as typeof activeContactConsents;
  }
  const consentByContact = new Map(
    activeContactConsents.map((c) => [c.family_contact_id, c])
  );

  const contactConsentRows: ContactConsentRow[] = contactRows.map((c) => {
    const active = consentByContact.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.name,
      relationship: c.relationship,
      email: c.email,
      activeConsentId: active?.id ?? null,
      activeConsentAt: active?.consented_at ?? null,
      attorneyReviewed: active?.attorney_reviewed ?? false,
    };
  });

  const residentFullName =
    `${resident.first_name} ${resident.last_name}`.trim();
  const consentPreviewByContactId: Record<string, string> = {};
  for (const c of contactRows) {
    consentPreviewByContactId[c.id] = renderFamilyContactConsentText(
      {
        orgName: typedOrg?.name ?? "Kinroster",
        dpoEmail: typedOrg?.email_reply_to ?? "privacy@kinroster.com",
        contactName: c.name,
        residentName: residentFullName,
      },
      "zh-TW"
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          PDPA Consent — {resident.first_name} {resident.last_name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Personal Data Protection Act consent records for this resident.
          Append-only ledger; capture a new record to update terms,
          withdraw an existing record to revoke.
        </p>
      </div>

      {!ATTORNEY_REVIEWED && (
        <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          <p className="font-medium">
            Consent text is PROVISIONAL — not attorney-reviewed.
          </p>
          <p className="text-xs mt-1">
            Version <code>{CONSENT_TEXT_VERSION}</code>. Captured records
            stamp this version so they can be re-captured later under
            attorney-approved copy. See{" "}
            <code>src/lib/pdpa/consent-text.ts</code>.
          </p>
        </div>
      )}

      <PdpaConsentManager
        residentId={residentId}
        residentName={residentFullName}
        consents={consents}
        consentPreview={consentPreviewZhTw}
        consentTextVersion={CONSENT_TEXT_VERSION}
      />

      <section className="space-y-3">
        <div>
          <h3 className="font-medium text-sm">Family contact consents</h3>
          <p className="text-xs text-muted-foreground">
            Each family contact must consent on their own behalf to receiving
            AI-drafted updates by email. This is separate from the
            resident&apos;s PHI processing consent above.
          </p>
        </div>
        <FamilyContactConsentList
          contacts={contactConsentRows}
          consentPreviewByContactId={consentPreviewByContactId}
          consentTextVersion={CONSENT_TEXT_VERSION}
        />
      </section>
    </div>
  );
}
