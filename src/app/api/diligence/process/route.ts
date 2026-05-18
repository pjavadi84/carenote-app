import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeDiligenceAudioFromUrl } from "@/lib/diligence/transcription";
import { summarizeDiligenceTranscript } from "@/lib/diligence/summarize";
import {
  createDiligenceReadUrl,
  deleteDiligenceObject,
  isOwnedPath,
} from "@/lib/diligence/storage";

interface ProcessRequest {
  storagePath?: unknown;
}

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

  const { data: appUser } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("id", user.id)
    .single();
  const typedUser = appUser as { id: string; organization_id: string } | null;
  if (!typedUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ProcessRequest;
  try {
    body = (await request.json()) as ProcessRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath required" }, { status: 400 });
  }
  if (!isOwnedPath(storagePath, typedUser.organization_id, typedUser.id)) {
    // Either malformed or it points outside the caller's org/user folder.
    // Refuse without distinguishing — don't leak the existence of other
    // paths.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const audioUrl = await createDiligenceReadUrl(storagePath);
    const transcription = await transcribeDiligenceAudioFromUrl(audioUrl);

    if (!transcription.transcript) {
      return NextResponse.json(
        {
          error:
            "Transcription returned no text — recording may be silent or unsupported",
        },
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
  } finally {
    // Audio is never persisted past the request. Delete on both success
    // and failure paths so we never leak bytes regardless of outcome.
    await deleteDiligenceObject(storagePath);
  }
}
