import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

type State =
  | { kind: "confirmed"; facilityName: string; residentFirstName: string }
  | { kind: "already_confirmed"; facilityName: string; residentFirstName: string }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "not_found" };

async function processToken(unsignedToken: string): Promise<State> {
  if (!unsignedToken || unsignedToken.length < 16) {
    return { kind: "not_found" };
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(unsignedToken)
    .digest("hex");

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("family_contact_confirmation_tokens")
    .select(
      "id, organization_id, family_contact_id, expires_at, revoked_at, confirmed_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const row = tokenRow as
    | {
        id: string;
        organization_id: string;
        family_contact_id: string;
        expires_at: string;
        revoked_at: string | null;
        confirmed_at: string | null;
      }
    | null;

  if (!row) return { kind: "not_found" };
  if (row.revoked_at) return { kind: "revoked" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { kind: "expired" };
  }

  // Look up the contact + resident + org for the success copy. Done before
  // the write so the rendered page can show specifics; the actual confirm
  // write is idempotent below.
  const { data: contactRow } = await admin
    .from("family_contacts")
    .select(
      "id, residents(first_name, organization_id, organizations(name))"
    )
    .eq("id", row.family_contact_id)
    .single();

  const contact = contactRow as
    | {
        id: string;
        residents: {
          first_name: string;
          organization_id: string;
          organizations: { name: string } | null;
        } | null;
      }
    | null;

  const residentFirstName = contact?.residents?.first_name ?? "the resident";
  const facilityName =
    contact?.residents?.organizations?.name ?? "the facility";

  // Idempotent: a second click after confirmation should still show success.
  if (row.confirmed_at) {
    return {
      kind: "already_confirmed",
      facilityName,
      residentFirstName,
    };
  }

  const now = new Date().toISOString();

  // Two writes, one logical operation. Order matters: the token row carries
  // the audit fact; the family_contacts column is the hot-path gate read by
  // /api/family/send. If the second write fails after the first succeeds,
  // we re-read the token row on the next click and trip the
  // already_confirmed branch above, which also retries the contacts update.
  await admin
    .from("family_contact_confirmation_tokens")
    .update({ confirmed_at: now })
    .eq("id", row.id);

  await admin
    .from("family_contacts")
    .update({ email_confirmed_at: now })
    .eq("id", row.family_contact_id);

  // Append-only audit. user_id is null because the family contact isn't an
  // app user — this is the unauthenticated public confirmation endpoint.
  await admin.from("audit_events").insert({
    organization_id: row.organization_id,
    user_id: null,
    event_type: "family_contact_confirmed",
    object_type: "family_contact",
    object_id: row.family_contact_id,
    metadata: {
      confirmation_token_id: row.id,
    },
  });

  return {
    kind: "confirmed",
    facilityName,
    residentFirstName,
  };
}

export default async function FamilyConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await processToken(token);

  if (state.kind === "confirmed" || state.kind === "already_confirmed") {
    const heading =
      state.kind === "confirmed"
        ? "You're confirmed."
        : "Already confirmed.";
    return (
      <div className="text-center space-y-4 py-8">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {state.facilityName} can now send you care updates about{" "}
          <strong>{state.residentFirstName}</strong>. There&apos;s nothing else
          you need to do — updates will arrive in this inbox whenever the care
          team sends one.
        </p>
        <p className="text-xs text-muted-foreground pt-4">
          If you change your mind, reply to any update email and ask the
          facility to stop sending. You can also ignore future emails — there
          are no further confirmations to click.
        </p>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="text-center space-y-4 py-8">
        <Clock className="h-12 w-12 text-amber-600 mx-auto" />
        <h1 className="text-2xl font-semibold">This link has expired.</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Confirmation links are valid for 30 days. Please ask the care
          facility to send you a new confirmation email.
        </p>
      </div>
    );
  }

  if (state.kind === "revoked") {
    return (
      <div className="text-center space-y-4 py-8">
        <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-semibold">This link is no longer active.</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          A newer confirmation link was sent to you. Please check your inbox
          for the most recent email and click that link instead.
        </p>
      </div>
    );
  }

  // not_found
  return (
    <div className="text-center space-y-4 py-8">
      <XCircle className="h-12 w-12 text-destructive mx-auto" />
      <h1 className="text-2xl font-semibold">Link not recognised.</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        We couldn&apos;t find this confirmation link. If you copied the URL from
        an email, double-check that nothing was cut off. Otherwise, ask the
        care facility to send you a fresh confirmation.
      </p>
    </div>
  );
}
