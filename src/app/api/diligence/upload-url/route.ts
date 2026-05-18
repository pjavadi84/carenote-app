import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_AUDIO_BYTES,
  buildDiligencePath,
  createDiligenceUploadUrl,
  isAllowedMimeType,
} from "@/lib/diligence/storage";

interface UploadUrlRequest {
  contentType?: unknown;
  contentLength?: unknown;
}

export const runtime = "nodejs";

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

  let body: UploadUrlRequest;
  try {
    body = (await request.json()) as UploadUrlRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  if (!isAllowedMimeType(contentType)) {
    return NextResponse.json(
      { error: `Unsupported audio type: ${contentType || "<unset>"}` },
      { status: 415 }
    );
  }

  const contentLength =
    typeof body.contentLength === "number" ? body.contentLength : null;
  if (contentLength !== null && contentLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (max ${Math.floor(MAX_AUDIO_BYTES / 1024 / 1024)}MB)`,
      },
      { status: 413 }
    );
  }

  const path = buildDiligencePath(typedUser.organization_id, typedUser.id, contentType);

  try {
    const upload = await createDiligenceUploadUrl(path);
    return NextResponse.json({
      path: upload.path,
      token: upload.token,
      signedUrl: upload.signedUrl,
      maxBytes: MAX_AUDIO_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create upload URL", details: message },
      { status: 502 }
    );
  }
}
