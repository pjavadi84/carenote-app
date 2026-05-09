import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { Json } from "@/types/database";
import {
  ATTORNEY_REVIEWED,
  CONSENT_TEXT_VERSION,
  renderCaregiverConsentText,
  type ConsentLocale,
} from "@/lib/pdpa/consent-text";

type CaregiverConsentMode = "self_ack" | "paper" | "withdraw";

interface CaregiverConsentBody {
  /** "self_ack": the caller is the caregiver and is acknowledging in-app.
   *  "paper": admin attests paper consent collected from a caregiver in
   *  their native language (id / vi / tl) outside the system.
   *  "withdraw": records withdrawal of any prior caregiver consent for
   *  the target user. */
  mode: CaregiverConsentMode;
  /** Required for "paper" + "withdraw"; ignored for "self_ack" (caller is
   *  always the data subject in that mode). */
  caregiverUserId?: string;
  /** Required for "self_ack" + "paper". For paper consent: the paper
   *  document version recorded outside the system (e.g., "paper-v1-id"). */
  consentVersion?: string;
  /** "zh-TW" or "en" for self_ack; "id" / "vi" / "tl" / "zh-TW" / "en"
   *  for paper (records what language the paper consent was in). */
  locale?: string;
  /** Required for "paper": where the paper original is filed. */
  paperReference?: string;
  /** Required for "withdraw". */
  reason?: string;
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
    .select("id, organization_id, role, full_name")
    .eq("id", user.id)
    .single();
  const typedUser = appUser as
    | {
        id: string;
        organization_id: string;
        role: string;
        full_name: string;
      }
    | null;
  if (!typedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: CaregiverConsentBody;
  try {
    body = (await request.json()) as CaregiverConsentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isAdmin =
    typedUser.role === "admin" || typedUser.role === "compliance_admin";

  // Mode-specific gating + target user resolution.
  let targetUserId: string;
  let consentType:
    | "caregiver_pdpa_self_ack"
    | "caregiver_pdpa_paper"
    | "caregiver_pdpa_withdraw";
  const metadata: Record<string, unknown> = {};

  if (body.mode === "self_ack") {
    targetUserId = typedUser.id;
    consentType = "caregiver_pdpa_self_ack";
    if (!body.locale || (body.locale !== "zh-TW" && body.locale !== "en")) {
      return NextResponse.json(
        {
          error:
            "self_ack supports zh-TW and en only. Use mode=paper to record native-language consent collected outside the system.",
        },
        { status: 400 }
      );
    }
    metadata.locale = body.locale;
    metadata.consent_text_version = CONSENT_TEXT_VERSION;
    metadata.attorney_reviewed = ATTORNEY_REVIEWED;
    // Snapshot the exact text the caregiver self-acknowledged.
    const { data: org } = await supabase
      .from("organizations")
      .select("name, email_reply_to")
      .eq("id", typedUser.organization_id)
      .single();
    const typedOrg = org as
      | { name: string; email_reply_to: string | null }
      | null;
    metadata.consent_text_snapshot = renderCaregiverConsentText(
      {
        orgName: typedOrg?.name ?? "Kinroster",
        dpoEmail: typedOrg?.email_reply_to ?? "privacy@kinroster.com",
        caregiverName: typedUser.full_name,
      },
      body.locale as ConsentLocale
    );
  } else if (body.mode === "paper") {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Paper-consent attestation is admin-only" },
        { status: 403 }
      );
    }
    if (!body.caregiverUserId) {
      return NextResponse.json(
        { error: "caregiverUserId required for paper mode" },
        { status: 400 }
      );
    }
    if (!body.locale?.trim() || !body.paperReference?.trim()) {
      return NextResponse.json(
        {
          error:
            "Paper mode requires locale (id/vi/tl/zh-TW/en) and paperReference (where the original is filed)",
        },
        { status: 400 }
      );
    }
    targetUserId = body.caregiverUserId;
    consentType = "caregiver_pdpa_paper";
    metadata.locale = body.locale.trim();
    metadata.paper_reference = body.paperReference.trim();
    metadata.attorney_reviewed = ATTORNEY_REVIEWED;
    metadata.attested_by = typedUser.full_name;
  } else if (body.mode === "withdraw") {
    if (!isAdmin && body.caregiverUserId && body.caregiverUserId !== typedUser.id) {
      return NextResponse.json(
        { error: "Non-admins can only withdraw their own consent" },
        { status: 403 }
      );
    }
    if (!body.reason?.trim()) {
      return NextResponse.json(
        { error: "reason required for withdraw" },
        { status: 400 }
      );
    }
    targetUserId = body.caregiverUserId ?? typedUser.id;
    consentType = "caregiver_pdpa_withdraw";
    metadata.reason = body.reason.trim();
    metadata.withdrawn_by = typedUser.full_name;
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Verify target user is in the same org. The consent_records RLS will
  // also check this, but we want a clean error before the insert.
  if (targetUserId !== typedUser.id) {
    const { data: target } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", targetUserId)
      .single();
    const typedTarget = target as { organization_id: string } | null;
    if (!typedTarget) {
      return NextResponse.json(
        { error: "Target caregiver not found" },
        { status: 404 }
      );
    }
    if (typedTarget.organization_id !== typedUser.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");

  const consentVersion =
    body.mode === "paper"
      ? body.consentVersion?.trim() || `paper-${body.locale ?? "unknown"}`
      : CONSENT_TEXT_VERSION;

  const { data: inserted, error: insertError } = await supabase
    .from("consent_records")
    .insert({
      organization_id: typedUser.organization_id,
      user_id: targetUserId,
      consent_type: consentType,
      consent_version: consentVersion,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: metadata as Json,
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
    eventType:
      consentType === "caregiver_pdpa_withdraw"
        ? "pdpa_consent_withdraw"
        : "pdpa_consent_capture",
    objectType: "pdpa_consent",
    objectId: insertedId,
    request,
    metadata: {
      caregiver_user_id: targetUserId,
      mode: body.mode,
      consent_version: consentVersion,
      ...metadata,
    },
  });

  return NextResponse.json({ id: insertedId });
}
