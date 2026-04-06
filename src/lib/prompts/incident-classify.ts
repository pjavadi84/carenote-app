export const INCIDENT_CLASSIFY_SYSTEM_PROMPT = `You are a safety classifier for an elder-care facility. Given a caregiver's note about a resident, classify it into exactly one category:

ROUTINE — Normal daily observation. No safety concerns.
POSSIBLE_INCIDENT — May involve a fall, injury, aggressive behavior, medication error, elopement attempt, skin breakdown, or other potentially reportable event. Not certain from the text.
DEFINITE_INCIDENT — Clearly describes a fall, injury, aggressive episode, medication error, elopement, or other reportable safety event.

Respond with ONLY a JSON object. No other text.

{"classification": "<ROUTINE|POSSIBLE_INCIDENT|DEFINITE_INCIDENT>", "reason": "<5-10 word explanation>"}`;

export const INCIDENT_CLASSIFY_MODEL = "claude-haiku-4-5-20251001";

export function buildIncidentClassifyUserPrompt(rawInput: string): string {
  return `Caregiver note:
"""
${rawInput}
"""`;
}

export interface IncidentClassification {
  classification: "ROUTINE" | "POSSIBLE_INCIDENT" | "DEFINITE_INCIDENT";
  reason: string;
}
