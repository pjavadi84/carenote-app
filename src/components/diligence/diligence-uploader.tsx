"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileAudio, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

interface Utterance {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
  language?: string;
}

interface Summary {
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

interface DiligenceResult {
  transcript: string;
  utterances: Utterance[];
  durationSeconds: number | null;
  detectedLanguages: string[];
  summary: Summary;
}

interface UploadUrlResponse {
  path: string;
  token: string;
  signedUrl: string;
  maxBytes: number;
}

const DILIGENCE_BUCKET = "diligence-uploads";
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
];

const EXTENSION_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

// Browsers sometimes hand us `File.type === ""` for `.m4a`/`.wav` recorded
// outside the standard MediaRecorder paths (Safari is the usual offender).
// Fall back to extension-based detection so the user can still upload.
function resolveMimeType(file: File): string {
  if (file.type && ACCEPTED_MIME_TYPES.includes(file.type)) return file.type;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return file.type || "";
  const ext = file.name.slice(dot + 1).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? file.type ?? "";
}

function formatDuration(seconds: number | null): string {
  if (!seconds && seconds !== 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">None noted.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

type Phase = "idle" | "requesting-url" | "uploading" | "processing";

export function DiligenceUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DiligenceResult | null>(null);

  const processing = phase !== "idle";

  function reset() {
    setFile(null);
    setResult(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) return;

    const mime = resolveMimeType(file);
    if (!ACCEPTED_MIME_TYPES.includes(mime)) {
      toast.error(
        `Unsupported audio type${file.type ? ` (${file.type})` : ""}. Try MP3, M4A, WAV, WEBM, OGG, or FLAC.`
      );
      return;
    }

    setResult(null);
    setPhase("requesting-url");

    try {
      const urlResponse = await fetch("/api/diligence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: mime,
          contentLength: file.size,
        }),
      });

      if (!urlResponse.ok) {
        const body = (await urlResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "Failed to start upload");
        setPhase("idle");
        return;
      }

      const upload = (await urlResponse.json()) as UploadUrlResponse;
      const maxBytes = upload.maxBytes ?? DEFAULT_MAX_BYTES;
      if (file.size > maxBytes) {
        toast.error(`File too large. Max ${Math.floor(maxBytes / 1024 / 1024)}MB.`);
        setPhase("idle");
        return;
      }

      setPhase("uploading");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(DILIGENCE_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, file, {
          contentType: mime,
          upsert: false,
        });
      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setPhase("idle");
        return;
      }

      setPhase("processing");
      const processResponse = await fetch("/api/diligence/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: upload.path }),
      });

      if (!processResponse.ok) {
        const body = (await processResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "Diligence processing failed");
        setPhase("idle");
        return;
      }

      const data = (await processResponse.json()) as DiligenceResult;
      setResult(data);
      toast.success("Recording processed");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Diligence failed: ${message}`);
    } finally {
      setPhase("idle");
    }
  }

  const buttonLabel = (() => {
    switch (phase) {
      case "requesting-url":
        return "Preparing upload…";
      case "uploading":
        return "Uploading…";
      case "processing":
        return "Transcribing & summarising…";
      default:
        return "Transcribe & summarise";
    }
  })();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Upload recording
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an audio recording of a conversation. Transcription
            supports English and Farsi code-switching. Audio is held in
            temporary storage only long enough for Deepgram to fetch it,
            then deleted.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={processing}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
          />
          {file && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!file || processing}
              className="gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {buttonLabel}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {buttonLabel}
                </>
              )}
            </Button>
            {(file || result) && !processing && (
              <Button variant="ghost" onClick={reset}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Results
              <span className="text-sm font-normal text-muted-foreground">
                · {formatDuration(result.durationSeconds)}
              </span>
              {result.detectedLanguages.length > 0 && (
                <div className="ml-auto flex flex-wrap gap-1">
                  {result.detectedLanguages.map((lang) => (
                    <Badge key={lang} variant="secondary">
                      {lang}
                    </Badge>
                  ))}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="speakers">Speakers</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Executive summary
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-foreground/90">
                    {result.summary.executive_summary || "No summary available."}
                  </p>
                </div>
                <ListSection title="Participants" items={result.summary.participants} />
                <ListSection title="Key topics" items={result.summary.key_topics} />
                <ListSection title="Decisions" items={result.summary.decisions} />
                <ListSection title="Action items" items={result.summary.action_items} />
                <ListSection title="Open questions" items={result.summary.open_questions} />
                <ListSection
                  title="Risks & concerns"
                  items={result.summary.risks_and_concerns}
                />
                <ListSection
                  title="Commitments made"
                  items={result.summary.commitments_made}
                />
                <ListSection title="Follow-ups" items={result.summary.follow_ups} />
                <ListSection
                  title="Notable quotes"
                  items={result.summary.notable_quotes}
                />
              </TabsContent>

              <TabsContent value="transcript" className="mt-4">
                <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {result.transcript}
                </pre>
              </TabsContent>

              <TabsContent value="speakers" className="mt-4">
                {result.utterances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No speaker-segmented utterances were returned.
                  </p>
                ) : (
                  <div className="max-h-[60vh] space-y-2 overflow-auto">
                    {result.utterances.map((u, i) => (
                      <div
                        key={i}
                        className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">
                            Speaker {u.speaker}
                          </span>
                          <span>
                            {formatTimestamp(u.start)}–{formatTimestamp(u.end)}
                          </span>
                          {u.language && <Badge variant="outline">{u.language}</Badge>}
                        </div>
                        <p className="text-foreground/90">{u.transcript}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
