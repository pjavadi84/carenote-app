// Caregivers can correct an AI-structured note via `edited_output`. Anywhere a
// downstream surface (clinician share, family update, weekly summary, voice
// grounding) reads back a note's structured content, the corrected version
// must win — otherwise the surgeon reads one thing in-app and another over
// email.

import { redactPhiText } from "@/lib/redaction";

export interface NoteOutputColumns {
  structured_output: string | null;
  edited_output: string | null;
}

/**
 * Plain effective output — edited wins, AI draft as fallback. USE FOR UI
 * RENDERING ONLY. Anywhere this output flows to a third-party LLM
 * (Claude / Vapi / Whisper response handoff), call
 * getEffectiveStructuredOutputForLlm instead so PHI redaction runs at the
 * boundary.
 */
export function getEffectiveStructuredOutput(
  note: NoteOutputColumns
): string | null {
  return note.edited_output ?? note.structured_output;
}

/**
 * Same as getEffectiveStructuredOutput, but routes the result through
 * the redactPhi layer (see src/lib/redaction.ts) so government IDs,
 * full DOBs, postal addresses, NHI card numbers, etc. are stripped
 * before the text leaves Kinroster's boundary for any LLM. Resident
 * given names + clinical content are preserved by design.
 *
 * Use this at the prompt-construction boundary — never write the
 * redacted result back to the database (raw_input + structured_output
 * remain authoritative sources of truth).
 */
export function getEffectiveStructuredOutputForLlm(
  note: NoteOutputColumns
): string | null {
  const text = getEffectiveStructuredOutput(note);
  return text == null ? null : redactPhiText(text);
}
