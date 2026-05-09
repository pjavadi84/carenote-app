// Caregivers can correct an AI-structured note via `edited_output`. Anywhere a
// downstream surface (clinician share, family update, weekly summary, voice
// grounding) reads back a note's structured content, the corrected version
// must win — otherwise the surgeon reads one thing in-app and another over
// email.

export interface NoteOutputColumns {
  structured_output: string | null;
  edited_output: string | null;
}

export function getEffectiveStructuredOutput(
  note: NoteOutputColumns
): string | null {
  return note.edited_output ?? note.structured_output;
}
