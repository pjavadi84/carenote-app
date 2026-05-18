// Claude summarizer for the diligence flow. Takes a Deepgram transcript
// (which may mix English + Farsi) and returns a structured 10-section
// diligence report. Uses Opus 4.7 — the highest-quality available model —
// because diligence outputs feed downstream decision-making and the call
// volume is low. If the model name is rejected by the installed SDK, the
// caller can fall back to Sonnet 4.6 by passing `model`.

import { callClaude, parseJsonResponse, type ClaudeModel } from "@/lib/claude";
import { DILIGENCE_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts/diligence-summary";

export const DILIGENCE_SECTIONS = [
  "executive_summary",
  "participants",
  "key_topics",
  "decisions",
  "action_items",
  "open_questions",
  "risks_and_concerns",
  "commitments_made",
  "follow_ups",
  "notable_quotes",
] as const;

export type DiligenceSectionKey = (typeof DILIGENCE_SECTIONS)[number];

export interface DiligenceSummary {
  executive_summary: string;
  participants: string[];
  key_topics: string[];
  decisions: string[];
  action_items: string[];
  open_questions: string[];
  risks_and_concerns: string[];
  commitments_made: string[];
  follow_ups: string[];
  notable_quotes: string[];
}

export interface SummarizeDiligenceOptions {
  transcript: string;
  detectedLanguages?: string[];
  model?: ClaudeModel;
}

export async function summarizeDiligenceTranscript({
  transcript,
  detectedLanguages,
  model = "claude-opus-4-7",
}: SummarizeDiligenceOptions): Promise<DiligenceSummary> {
  const languageNote = detectedLanguages?.length
    ? `Detected languages in transcript: ${detectedLanguages.join(", ")}. Preserve the speaker's words verbatim in "notable_quotes"; render everything else in English.`
    : "";

  const userPrompt = [
    languageNote,
    "Transcript:",
    transcript,
    "",
    'Return ONLY a JSON object with the keys listed in the system prompt. No prose, no code fences.',
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callClaude({
    model,
    systemPrompt: DILIGENCE_SUMMARY_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
  });

  const parsed = parseJsonResponse<Partial<DiligenceSummary>>(raw);

  const ensureArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    executive_summary:
      typeof parsed.executive_summary === "string" ? parsed.executive_summary : "",
    participants: ensureArray(parsed.participants),
    key_topics: ensureArray(parsed.key_topics),
    decisions: ensureArray(parsed.decisions),
    action_items: ensureArray(parsed.action_items),
    open_questions: ensureArray(parsed.open_questions),
    risks_and_concerns: ensureArray(parsed.risks_and_concerns),
    commitments_made: ensureArray(parsed.commitments_made),
    follow_ups: ensureArray(parsed.follow_ups),
    notable_quotes: ensureArray(parsed.notable_quotes),
  };
}
