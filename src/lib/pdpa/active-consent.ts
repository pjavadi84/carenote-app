import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true iff the resident has at least one resident_pdpa_consents
 * row with withdrawn_at IS NULL. Org scoping is enforced by RLS — callers
 * must pass an authed client.
 *
 * Use this to gate any data-processing surface that needs PDPA consent
 * (family update generation, voice intake, weekly summaries, etc.).
 *
 * NOTE: presence of a row does not certify that the consent text itself
 * was attorney-reviewed — see consent-text.ts ATTORNEY_REVIEWED. For
 * pre-attorney testing, the org-level setting `pdpa_consent_required`
 * controls whether this gate is enforced or merely advisory.
 */
export async function hasActivePdpaConsent(
  supabase: SupabaseClient,
  residentId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("resident_pdpa_consents")
    .select("id", { count: "exact", head: true })
    .eq("resident_id", residentId)
    .is("withdrawn_at", null);

  if (error) {
    // Conservative: on error, assume no consent. Surfaces should display
    // a clear "consent check failed — investigate" message rather than
    // proceeding optimistically.
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Did the org opt into hard-blocking on missing consent? Read from
 * organizations.settings.pdpa_consent_required. Defaults to false so
 * existing orgs aren't broken by the introduction of the gate; orgs
 * processing real patient data flip this on explicitly.
 */
export function pdpaConsentRequired(
  settings: Record<string, unknown> | null | undefined
): boolean {
  return settings?.pdpa_consent_required === true;
}

/**
 * Returns true iff the family contact has at least one
 * family_contact_pdpa_consents row with withdrawn_at IS NULL.
 *
 * Distinct from hasActivePdpaConsent (which is the resident's PHI
 * processing consent). The family contact's own consent is the basis
 * for the org processing the family member's contact data + emailing
 * them. Both consents are required for a family update send under PDPA.
 */
export async function hasActiveFamilyContactConsent(
  supabase: SupabaseClient,
  familyContactId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("family_contact_pdpa_consents")
    .select("id", { count: "exact", head: true })
    .eq("family_contact_id", familyContactId)
    .is("withdrawn_at", null);

  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Caregiver-side PDPA acknowledgment. Reads the existing consent_records
 * table for one of two consent_type values:
 *
 *   - "caregiver_pdpa_self_ack": the caregiver self-acknowledged in the
 *     app (currently zh-TW or en only — id / vi / tl pending attorney +
 *     translator).
 *   - "caregiver_pdpa_paper": an admin attested that paper consent was
 *     collected from the caregiver in their native language and filed
 *     per Taiwan labor law.
 *
 * Either is sufficient. consent_records is append-only — there's no
 * withdrawn_at column, so "active" here means "any matching row exists
 * for this user." Withdrawal of caregiver consent is recorded by
 * inserting a new row with consent_type = "caregiver_pdpa_withdraw"
 * and the helper checks that no withdrawal supersedes the most recent
 * acceptance.
 */
export async function hasCaregiverPdpaConsent(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consent_records")
    .select("consent_type, accepted_at")
    .eq("user_id", userId)
    .in("consent_type", [
      "caregiver_pdpa_self_ack",
      "caregiver_pdpa_paper",
      "caregiver_pdpa_withdraw",
    ])
    .order("accepted_at", { ascending: false });

  if (error || !data || data.length === 0) return false;

  // The most recent row wins. If it's a withdrawal, no active consent.
  const mostRecent = data[0] as {
    consent_type: string;
    accepted_at: string;
  };
  return mostRecent.consent_type !== "caregiver_pdpa_withdraw";
}
