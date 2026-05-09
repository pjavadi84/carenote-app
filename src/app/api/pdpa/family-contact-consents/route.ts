import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  ATTORNEY_REVIEWED,
  CONSENT_TEXT_VERSION,
  renderFamilyContactConsentText,
  type ConsentLocale,
} from "@/lib/pdpa/consent-text";

interface CaptureBody {
  familyContactId: string;
  consentingPartyName: string;
  signedTypedName: string;
  locale: ConsentLocale;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  const typedUser = appUser as
    | { organization_id: string; role: string }
    | null;
  if (!typedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (typedUser.role !== "admin" && typedUser.role !== "compliance_admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: CaptureBody;
  try {
    body = (await request.json()) as CaptureBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.familyContactId ||
    !body.consentingPartyName?.trim() ||
    !body.signedTypedName?.trim() ||
    !body.locale
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (body.locale !== "zh-TW" && body.locale !== "en") {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  // Load contact + resident + org. RLS scopes to caller's org.
  const { data: contact } = await supabase
    .from("family_contacts")
    .select("id, name, resident_id, organization_id")
    .eq("id", body.familyContactId)
    .single();
  const typedContact = contact as
    | {
        id: string;
        name: string;
        resident_id: string;
        organization_id: string;
      }
    | null;
  if (!typedContact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  if (typedContact.organization_id !== typedUser.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: resident } = await supabase
    .from("residents")
    .select("first_name, last_name")
    .eq("id", typedContact.resident_id)
    .single();
  const typedResident = resident as
    | { first_name: string; last_name: string }
    | null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, email_reply_to")
    .eq("id", typedUser.organization_id)
    .single();
  const typedOrg = org as
    | { name: string; email_reply_to: string | null }
    | null;

  const snapshot = renderFamilyContactConsentText(
    {
      orgName: typedOrg?.name ?? "Kinroster",
      dpoEmail: typedOrg?.email_reply_to ?? "privacy@kinroster.com",
      contactName: typedContact.name,
      residentName:
        `${typedResident?.first_name ?? ""} ${typedResident?.last_name ?? ""}`.trim() ||
        "—",
    },
    body.locale
  );

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");

  const { data: inserted, error: insertError } = await supabase
    .from("family_contact_pdpa_consents")
    .insert({
      organization_id: typedUser.organization_id,
      family_contact_id: typedContact.id,
      consenting_party_name: body.consentingPartyName.trim(),
      consent_text_version: CONSENT_TEXT_VERSION,
      consent_text_locale: body.locale,
      consent_text_snapshot: snapshot,
      attorney_reviewed: ATTORNEY_REVIEWED,
      signed_typed_name: body.signedTypedName.trim(),
      captured_by_user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Failed to record consent", details: insertError?.message },
      { status: 500 }
    );
  }

  const insertedId = (inserted as { id: string }).id;

  await logAudit({
    organizationId: typedUser.organization_id,
    userId: user.id,
    eventType: "pdpa_consent_capture",
    objectType: "pdpa_consent",
    objectId: insertedId,
    request,
    metadata: {
      family_contact_id: typedContact.id,
      resident_id: typedContact.resident_id,
      consent_text_version: CONSENT_TEXT_VERSION,
      attorney_reviewed: ATTORNEY_REVIEWED,
      locale: body.locale,
      scope: "family_contact",
    },
  });

  return NextResponse.json({ id: insertedId });
}
