import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  ATTORNEY_REVIEWED,
  CONSENT_TEXT_VERSION,
  renderConsentText,
  type ConsentLocale,
} from "@/lib/pdpa/consent-text";

interface CaptureBody {
  residentId: string;
  consentingPartyType: "resident" | "personal_representative";
  consentingPartyName: string;
  consentingPartyRelationship?: string | null;
  consentingPartyIdLast4?: string | null;
  signedTypedName: string;
  locale: ConsentLocale;
}

function isValidLast4(s: string | null | undefined): boolean {
  if (s == null || s === "") return true;
  return /^\d{4}$/.test(s);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only — capturing consent on behalf of a resident is a regulatory
  // act and must be attributable to a named accountable user.
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

  // Required fields.
  if (
    !body.residentId ||
    !body.consentingPartyType ||
    !body.consentingPartyName?.trim() ||
    !body.signedTypedName?.trim() ||
    !body.locale
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (
    body.consentingPartyType !== "resident" &&
    body.consentingPartyType !== "personal_representative"
  ) {
    return NextResponse.json(
      { error: "Invalid consentingPartyType" },
      { status: 400 }
    );
  }
  if (body.locale !== "zh-TW" && body.locale !== "en") {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  if (!isValidLast4(body.consentingPartyIdLast4 ?? null)) {
    return NextResponse.json(
      { error: "ID last 4 must be 4 digits or omitted" },
      { status: 400 }
    );
  }

  // Personal representative must declare a relationship to the resident.
  if (
    body.consentingPartyType === "personal_representative" &&
    !body.consentingPartyRelationship?.trim()
  ) {
    return NextResponse.json(
      { error: "Personal representative must declare relationship" },
      { status: 400 }
    );
  }

  // Load resident + org so we can render the consent text snapshot. RLS
  // will reject cross-org reads.
  const { data: resident } = await supabase
    .from("residents")
    .select("id, organization_id, first_name, last_name")
    .eq("id", body.residentId)
    .single();
  const typedResident = resident as
    | {
        id: string;
        organization_id: string;
        first_name: string;
        last_name: string;
      }
    | null;
  if (!typedResident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }
  if (typedResident.organization_id !== typedUser.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name, email_reply_to")
    .eq("id", typedUser.organization_id)
    .single();
  const typedOrg = org as
    | { name: string; email_reply_to: string | null }
    | null;

  // Render + freeze the exact text the consenting party agreed to. Stored
  // verbatim so years later we can prove what they actually saw.
  const snapshot = renderConsentText(
    {
      orgName: typedOrg?.name ?? "Kinroster",
      dpoEmail: typedOrg?.email_reply_to ?? "privacy@kinroster.com",
      residentName: `${typedResident.first_name} ${typedResident.last_name}`.trim(),
    },
    body.locale
  );

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");

  const { data: inserted, error: insertError } = await supabase
    .from("resident_pdpa_consents")
    .insert({
      organization_id: typedUser.organization_id,
      resident_id: typedResident.id,
      consenting_party_type: body.consentingPartyType,
      consenting_party_name: body.consentingPartyName.trim(),
      consenting_party_relationship:
        body.consentingPartyRelationship?.trim() || null,
      consenting_party_id_last4: body.consentingPartyIdLast4 || null,
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
      resident_id: typedResident.id,
      consenting_party_type: body.consentingPartyType,
      consent_text_version: CONSENT_TEXT_VERSION,
      attorney_reviewed: ATTORNEY_REVIEWED,
      locale: body.locale,
    },
  });

  return NextResponse.json({ id: insertedId });
}
