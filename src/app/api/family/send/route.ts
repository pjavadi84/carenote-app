import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendFamilyEmail } from "@/lib/resend";
import { logAudit } from "@/lib/audit";
import {
  appendFamilyDisclosureFooter,
  buildFamilyDisclosureFooter,
  localeForRegulatoryRegion,
} from "@/lib/family/disclosure-footer";
import {
  hasActiveFamilyContactConsent,
  hasActivePdpaConsent,
  pdpaConsentRequired,
} from "@/lib/pdpa/active-consent";

type LegalBasis =
  | "personal_representative"
  | "patient_authorization"
  | "patient_agreement";

type ContactRow = {
  email: string | null;
  name: string;
  involved_in_care: boolean;
  personal_representative: boolean;
  authorization_on_file: boolean;
  authorization_end_date: string | null;
  revoked_at: string | null;
  authorization_scope: string[];
};

function deriveLegalBasis(contact: ContactRow): LegalBasis | null {
  if (contact.personal_representative) return "personal_representative";
  if (contact.authorization_on_file) return "patient_authorization";
  if (contact.involved_in_care) return "patient_agreement";
  return null;
}

function isAuthorizationExpired(contact: ContactRow): boolean {
  if (!contact.authorization_end_date) return false;
  return new Date(contact.authorization_end_date) < new Date();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The send is the regulatory accountability anchor — only an admin (or
  // compliance_admin acting in that capacity) may approve a family-facing
  // AI-drafted message. F4 #5 from the May 2026 Taiwan due-diligence brief.
  const { data: appUser } = await supabase
    .from("users")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  const typedAppUser = appUser as
    | { organization_id: string; role: string; full_name: string }
    | null;

  if (!typedAppUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (
    typedAppUser.role !== "admin" &&
    typedAppUser.role !== "compliance_admin"
  ) {
    return NextResponse.json(
      { error: "Only admins can approve and send family updates" },
      { status: 403 }
    );
  }

  const { communicationId } = await request.json();

  if (!communicationId) {
    return NextResponse.json(
      { error: "communicationId required" },
      { status: 400 }
    );
  }

  const { data: comm } = await supabase
    .from("family_communications")
    .select(
      `*, family_contacts(
        email, name,
        involved_in_care, personal_representative, authorization_on_file,
        authorization_end_date, revoked_at, authorization_scope
      )`
    )
    .eq("id", communicationId)
    .single();

  if (!comm) {
    return NextResponse.json(
      { error: "Communication not found" },
      { status: 404 }
    );
  }

  const typedComm = comm as {
    id: string;
    organization_id: string;
    resident_id: string;
    recipient_contact_id: string;
    source_note_ids: string[] | null;
    subject: string;
    body: string;
    status: string;
    family_contacts: ContactRow | null;
  };

  if (typedComm.status === "sent") {
    return NextResponse.json(
      { error: "This update has already been sent." },
      { status: 409 }
    );
  }

  if (!typedComm.family_contacts) {
    return NextResponse.json(
      { error: "Recipient contact not found" },
      { status: 404 }
    );
  }

  const contact = typedComm.family_contacts;

  if (!contact.email) {
    return NextResponse.json(
      { error: "Recipient has no email address" },
      { status: 400 }
    );
  }

  // Fetch org settings (incl. feature flag) + from/reply-to metadata +
  // regulatory_region (drives footer locale).
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, email_from_name, email_reply_to, settings, regulatory_region"
    )
    .eq("id", typedComm.organization_id)
    .single();

  const typedOrg = org as {
    name: string;
    email_from_name: string | null;
    email_reply_to: string | null;
    settings: Record<string, unknown> | null;
    regulatory_region: string | null;
  } | null;

  const familyAuthRequired =
    typedOrg?.settings?.family_auth_required === true;

  // PDPA gate. Two consents are required at send time when the org is
  // gated: (1) the resident's PHI processing consent, and (2) the family
  // contact's own consent for the org to email them. Both are checked.
  if (pdpaConsentRequired(typedOrg?.settings)) {
    const [residentOk, contactOk] = await Promise.all([
      hasActivePdpaConsent(supabase, typedComm.resident_id),
      hasActiveFamilyContactConsent(
        supabase,
        typedComm.recipient_contact_id
      ),
    ]);
    if (!residentOk || !contactOk) {
      return NextResponse.json(
        {
          error:
            "PDPA consent missing. Both the resident's PHI consent and the family contact's email consent must be on file before sending.",
          code: "pdpa_consent_required",
          missing: {
            resident: !residentOk,
            family_contact: !contactOk,
          },
        },
        { status: 403 }
      );
    }
  }

  const legalBasis = deriveLegalBasis(contact);

  // Authorization gate — only enforced when the org opted in.
  if (familyAuthRequired) {
    if (!legalBasis) {
      return NextResponse.json(
        {
          error:
            "This contact has no legal basis on file for receiving updates. Update the contact record first.",
        },
        { status: 403 }
      );
    }
    if (contact.revoked_at) {
      return NextResponse.json(
        { error: "Sharing with this contact has been revoked." },
        { status: 403 }
      );
    }
    if (isAuthorizationExpired(contact)) {
      return NextResponse.json(
        {
          error:
            "This contact's signed authorization has expired. Update the end date first.",
        },
        { status: 403 }
      );
    }
  }

  const replyTo = typedOrg?.email_reply_to || "noreply@kinroster.com";

  // Compose + freeze the disclosure footer at send time. Stored separately
  // from the body so the audit log can later re-render exactly what the
  // family received and who approved it.
  const footer = buildFamilyDisclosureFooter({
    clinicianName: typedAppUser.full_name,
    replyTo,
    locale: localeForRegulatoryRegion(typedOrg?.regulatory_region),
  });
  const bodyWithFooter = appendFamilyDisclosureFooter(typedComm.body, footer);

  try {
    await sendFamilyEmail({
      to: contact.email,
      fromName: typedOrg?.email_from_name || typedOrg?.name || "Kinroster",
      replyTo,
      subject: typedComm.subject,
      body: bodyWithFooter,
    });

    const nowIso = new Date().toISOString();
    await supabase
      .from("family_communications")
      .update({
        status: "sent",
        sent_at: nowIso,
        approved_by: user.id,
        approved_at: nowIso,
        disclosure_footer: footer,
      })
      .eq("id", communicationId);

    // Always log the disclosure — flag or no flag. If there is no legal
    // basis (legacy org on the old flow), record "patient_agreement" as
    // the assumed basis for backward-compat; new flows reject earlier.
    await supabase.from("disclosure_events").insert({
      organization_id: typedComm.organization_id,
      resident_id: typedComm.resident_id,
      actor_user_id: user.id,
      recipient_type: "family_contact",
      recipient_id: typedComm.recipient_contact_id,
      legal_basis: legalBasis ?? "patient_agreement",
      categories_shared:
        contact.authorization_scope && contact.authorization_scope.length > 0
          ? contact.authorization_scope
          : ["wellbeing_summary"],
      source_note_ids: typedComm.source_note_ids ?? [],
      delivery_method: "email",
    });

    await logAudit({
      organizationId: typedComm.organization_id,
      userId: user.id,
      eventType: "family_send",
      objectType: "family_contact",
      objectId: typedComm.recipient_contact_id,
      request,
      metadata: {
        resident_id: typedComm.resident_id,
        communication_id: typedComm.id,
        legal_basis: legalBasis ?? "patient_agreement",
        enforcement_on: familyAuthRequired,
        approver_id: user.id,
        approver_name: typedAppUser.full_name,
        disclosure_footer_locale: localeForRegulatoryRegion(
          typedOrg?.regulatory_region
        ),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("family_communications")
      .update({ status: "failed" })
      .eq("id", communicationId);

    return NextResponse.json(
      { error: "Failed to send email", details: message },
      { status: 500 }
    );
  }
}
