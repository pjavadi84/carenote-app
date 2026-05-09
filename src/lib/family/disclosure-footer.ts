// Disclosure footer auto-injected on every AI-drafted family update before
// send. Implements C5 + F4 #5 from the May 2026 Taiwan due-diligence brief:
//
//   - Statement that the message was prepared with AI assistance
//   - Statement that a physician or licensed clinician reviewed it
//   - Identity of the reviewing clinician
//   - Contact for questions or corrections
//
// Locale follows the org's regulatory_region: pdpa_tw → zh-TW, others → en.
// The id / vi / tl caregiver-facing locales are deliberately NOT options
// here — the family-update body is for the family contact (zh-TW or English),
// not for the caregiver.
//
// IMPORTANT: the zh-TW string is a working draft. The brief explicitly notes
// that consent / disclosure copy in this domain "should be drafted by a
// qualified Taiwan-licensed attorney and a certified medical translator" —
// review and replace before first patient enrolment.

export type FamilyDisclosureLocale = "en" | "zh-TW";

export interface FamilyDisclosureFooterParams {
  clinicianName: string;
  replyTo: string;
  locale: FamilyDisclosureLocale;
}

export function localeForRegulatoryRegion(
  regulatoryRegion: string | null | undefined
): FamilyDisclosureLocale {
  return regulatoryRegion === "pdpa_tw" ? "zh-TW" : "en";
}

export function buildFamilyDisclosureFooter(
  params: FamilyDisclosureFooterParams
): string {
  const reviewer = params.clinicianName.trim() || "the clinical team";
  const contact = params.replyTo.trim();

  if (params.locale === "zh-TW") {
    // DRAFT — Taiwan-licensed attorney to review.
    return [
      "—",
      `本訊息根據看護人員的觀察由 AI 協助撰寫，並由 ${reviewer} 於發送前審閱。`,
      `如有疑問或需要更正，請聯繫 ${contact}。`,
    ].join("\n");
  }

  return [
    "—",
    `This message was prepared with AI assistance from caregiver observations and reviewed by ${reviewer} before sending.`,
    `For questions or corrections, contact ${contact}.`,
  ].join("\n");
}

export function appendFamilyDisclosureFooter(
  body: string,
  footer: string
): string {
  const trimmedBody = body.replace(/\s+$/u, "");
  return `${trimmedBody}\n\n${footer}\n`;
}
