import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Bucket created by migration 00027_diligence_uploads_bucket.sql.
export const DILIGENCE_BUCKET = "diligence-uploads";

// Max audio file size accepted by the upload-URL route. Storage also
// enforces this server-side via the bucket's `file_size_limit`, but we
// echo it to the client so over-cap files fail before the upload starts.
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

// Allowed audio mime types. Mirrors the bucket's `allowed_mime_types`
// configuration so the rejection happens client-side with a clear message
// rather than as an opaque Storage error mid-upload.
const ALLOWED_MIME_TYPES = new Set([
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
]);

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

export function isAllowedMimeType(mime: string | null | undefined): boolean {
  return !!mime && ALLOWED_MIME_TYPES.has(mime);
}

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "bin";
}

// Path layout: `<org_id>/<user_id>/<random>.<ext>`. The first two
// segments make path-ownership checks trivial: the requester's
// (organization_id, id) must match the prefix or the request is rejected.
export function buildDiligencePath(
  organizationId: string,
  userId: string,
  mime: string
): string {
  const random = crypto.randomBytes(16).toString("hex");
  const ext = extensionForMime(mime);
  return `${organizationId}/${userId}/${random}.${ext}`;
}

export function isOwnedPath(
  path: string,
  organizationId: string,
  userId: string
): boolean {
  const segments = path.split("/");
  if (segments.length !== 3) return false;
  const [orgSegment, userSegment, file] = segments;
  if (orgSegment !== organizationId || userSegment !== userId) return false;
  // File name must look like `<hex>.<ext>` — defense in depth against
  // attempts to traverse via the third segment.
  if (!/^[a-f0-9]{32}\.[a-z0-9]{2,5}$/i.test(file)) return false;
  return true;
}

export async function createDiligenceUploadUrl(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DILIGENCE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
  }
  return data;
}

// Short-lived signed URL handed to Deepgram so it can fetch the audio
// directly from Storage. 10 minutes is enough for Deepgram to download +
// transcribe a long recording with margin.
const DEEPGRAM_FETCH_TTL_SECONDS = 600;

export async function createDiligenceReadUrl(path: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(DILIGENCE_BUCKET)
    .createSignedUrl(path, DEEPGRAM_FETCH_TTL_SECONDS);
  if (error || !data) {
    throw new Error(`Failed to create signed read URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

export async function deleteDiligenceObject(path: string): Promise<void> {
  const admin = createAdminClient();
  // Best-effort: log+swallow on failure. The pipeline has already
  // returned a result to the user; a leftover object is a janitor
  // problem, not a request-blocking error.
  const { error } = await admin.storage.from(DILIGENCE_BUCKET).remove([path]);
  if (error) {
    console.warn(`Failed to delete diligence object ${path}: ${error.message}`);
  }
}
