import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeDiligenceAudio } from "@/lib/diligence/transcription";
import { summarizeDiligenceTranscript } from "@/lib/diligence/summarize";

// Max audio size accepted by this route. Deepgram itself permits much
// larger files, but capping here keeps a single upload from chewing
// through a long-running serverless request.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form body" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Audio file required" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio file too large (max ${Math.floor(MAX_AUDIO_BYTES / 1024 / 1024)}MB)` },
      { status: 413 }
    );
  }

  try {
    const transcription = await transcribeDiligenceAudio(
      audio,
      audio.type || "application/octet-stream"
    );

    if (!transcription.transcript) {
      return NextResponse.json(
        { error: "Transcription returned no text — recording may be silent or unsupported" },
        { status: 422 }
      );
    }

    const summary = await summarizeDiligenceTranscript({
      transcript: transcription.transcript,
      detectedLanguages: transcription.detectedLanguages,
    });

    return NextResponse.json({
      transcript: transcription.transcript,
      utterances: transcription.utterances,
      durationSeconds: transcription.durationSeconds,
      detectedLanguages: transcription.detectedLanguages,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Diligence processing failed", details: message },
      { status: 502 }
    );
  }
}
