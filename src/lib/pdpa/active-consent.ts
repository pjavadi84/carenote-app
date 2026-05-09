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
