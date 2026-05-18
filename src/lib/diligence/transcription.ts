// Deepgram REST transcription for the diligence flow. Unlike the
// caregiver-note path (which uses Whisper via /api/transcribe), diligence
// recordings are uploaded conversations that may code-switch between
// English and Farsi. Deepgram's nova-3 with `multi` language handles that
// directly and also gives us speaker diarization + utterance segments,
// which the diligence UI surfaces alongside the structured summary.
//
// We never proxy the audio bytes through our serverless function — Vercel
// caps request bodies at ~4.5 MB and diligence recordings are routinely
// 10-100x that. Instead the browser uploads the file directly to Supabase
// Storage, and we hand Deepgram a short-lived signed read URL. Audio is
// deleted from Storage as soon as transcription returns, matching the
// CLAUDE.md rule that audio is not persisted.

const DEEPGRAM_ENDPOINT = "https://api.deepgram.com/v1/listen";

export interface DiligenceUtterance {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
  language?: string;
}

export interface DiligenceTranscription {
  transcript: string;
  utterances: DiligenceUtterance[];
  durationSeconds: number | null;
  detectedLanguages: string[];
}

interface DeepgramAlternative {
  transcript: string;
  languages?: string[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
  detected_language?: string;
}

interface DeepgramUtterance {
  speaker?: number;
  start: number;
  end: number;
  transcript: string;
  languages?: string[];
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
}

export async function transcribeDiligenceAudioFromUrl(
  audioUrl: string
): Promise<DiligenceTranscription> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    model: "nova-3",
    language: "multi",
    diarize: "true",
    utterances: "true",
    punctuate: "true",
    smart_format: "true",
  });

  const response = await fetch(`${DEEPGRAM_ENDPOINT}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Deepgram transcription failed (${response.status}): ${detail}`);
  }

  const body = (await response.json()) as DeepgramResponse;

  const channel = body.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const transcript = alternative?.transcript?.trim() ?? "";

  const utterances: DiligenceUtterance[] = (body.results?.utterances ?? []).map(
    (u) => ({
      speaker: u.speaker ?? 0,
      start: u.start,
      end: u.end,
      transcript: u.transcript,
      language: u.languages?.[0],
    })
  );

  const detectedLanguages = Array.from(
    new Set(
      [
        ...(alternative?.languages ?? []),
        ...(channel?.detected_language ? [channel.detected_language] : []),
        ...utterances.flatMap((u) => (u.language ? [u.language] : [])),
      ].filter(Boolean)
    )
  );

  return {
    transcript,
    utterances,
    durationSeconds: body.metadata?.duration ?? null,
    detectedLanguages,
  };
}
