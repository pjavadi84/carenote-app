import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio") as Blob | null;

  if (!audio) {
    return NextResponse.json({ error: "Audio file required" }, { status: 400 });
  }

  // Validate audio size (max 25MB for Whisper)
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Audio file too large (max 25MB)" },
      { status: 400 }
    );
  }

  try {
    // Send to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audio, "recording.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "en");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Transcription failed", details: error },
        { status: 502 }
      );
    }

    const result = await response.json();

    // Audio is never stored — only the transcript is returned
    return NextResponse.json({ transcript: result.text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Transcription failed", details: message },
      { status: 500 }
    );
  }
}
