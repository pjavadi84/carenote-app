import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendFamilyContactConfirmation } from "@/lib/resend";
import { logAudit } from "@/lib/audit";
import {
  generateConfirmationToken,
  defaultExpiresAt,
} from "@/lib/family-contact-confirmation";

// Admin-only. Generates a single-use confirmation token, stores its SHA-256
// hash, and emails the unsigned token to the family contact as a click link.
// Until the recipient clicks (proving the address is reachable and consenting
// to receive updates), /api/family/send refuses to deliver substantive PHI to
// this contact. See migration 00025 for the data model.
//
// Calling this on a contact whose email_confirmed_at is already populated
// regenerates the token and clears email_confirmed_at — useful when the
// admin corrects a typo in the email field after a prior confirmation, or
// resends to a contact who lost the original email.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: familyContactId } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .single();

  const typedAppUser = appUser as
    | { organization_id: string; role: string }
    | null;

  if (!typedAppUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (
    typedAppUser.role !== "admin" &&
    typedAppUser.role !== "compliance_admin"
  ) {
    return NextResponse.json(
      { error: "Only admins can send confirmation emails" },
      { status: 403 }
    );
  }

  // Family contact + resident (RLS already scopes to this admin's org).
  const { data: contactRow } = await supabase
    .from("family_contacts")
    .select(
      "id, name, email, resident_id, residents(first_name, organization_id)"
    )
    .eq("id", familyContactId)
    .single();

  const contact = contactRow as
    | {
        id: string;
        name: string;
        email: string | null;
        resident_id: string;
        residents: {
          first_name: string;
          organization_id: string;
        } | null;
      }
    | null;

  if (!contact) {
    return NextResponse.json(
      { error: "Family contact not found" },
      { status: 404 }
    );
  }
  if (!contact.email) {
    return NextResponse.json(
      { error: "This contact has no email address on file" },
      { status: 400 }
    );
  }
  if (!contact.residents) {
    return NextResponse.json(
      { error: "Resident not found for contact" },
      { status: 404 }
    );
  }

  const orgId = contact.residents.organization_id;
  if (orgId !== typedAppUser.organization_id) {
    // Defense in depth — RLS should already prevent cross-org reads.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Org metadata for email branding.
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, email_from_name, email_reply_to")
    .eq("id", orgId)
    .single();

  const org = orgRow as
    | {
        name: string;
        email_from_name: string | null;
        email_reply_to: string | null;
      }
    | null;

  // Revoke any outstanding unconfirmed tokens for this contact so only the
  // newest link is redeemable. Idempotent — affects 0 rows if none exist.
  await supabase
    .from("family_contact_confirmation_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("family_contact_id", familyContactId)
    .is("confirmed_at", null)
    .is("revoked_at", null);

  // Generate fresh token. Unsigned value is returned once for the email;
  // only the SHA-256 hash is persisted (mirrors clinician portal pattern).
  const { unsigned, hash } = generateConfirmationToken();
  const expiresAt = defaultExpiresAt();

  const { error: insertError } = await supabase
    .from("family_contact_confirmation_tokens")
    .insert({
      organization_id: orgId,
      family_contact_id: familyContactId,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
      email_at_send: contact.email,
      created_by: authUser.id,
    });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create confirmation token", details: insertError.message },
      { status: 500 }
    );
  }

  // Clear any prior confirmation. If the admin is regenerating because the
  // email field changed (typo fix), we want the gate to re-engage until the
  // new address is confirmed.
  await supabase
    .from("family_contacts")
    .update({ email_confirmed_at: null })
    .eq("id", familyContactId);

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    `https://${request.headers.get("host") || "kinroster.com"}`;
  const confirmUrl = `${origin}/family/confirm/${unsigned}`;

  // Best-effort send. If the email fails, the token row exists and admin can
  // retry from the UI; no PHI was disclosed in either case.
  try {
    await sendFamilyContactConfirmation({
      to: contact.email,
      contactName: contact.name,
      residentFirstName: contact.residents.first_name,
      facilityName: org?.name || "Our Facility",
      fromName: org?.email_from_name || org?.name || "Kinroster",
      replyTo: org?.email_reply_to || "noreply@kinroster.com",
      confirmUrl,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to send confirmation email",
        details: message,
      },
      { status: 502 }
    );
  }

  await logAudit({
    organizationId: orgId,
    userId: authUser.id,
    eventType: "family_contact_confirmation_sent",
    objectType: "family_contact",
    objectId: familyContactId,
    request,
    metadata: {
      resident_id: contact.resident_id,
      email_at_send: contact.email,
      expires_at: expiresAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    expires_at: expiresAt.toISOString(),
  });
}
