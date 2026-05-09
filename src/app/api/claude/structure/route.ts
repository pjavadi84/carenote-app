import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkQuotaAndIncrement } from "@/lib/quota";
import { structureNote } from "@/lib/services/structure-note";

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
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (appUser) {
    const quota = await checkQuotaAndIncrement(appUser.organization_id, "ai");
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason }, { status: 429 });
    }
  }

  const { noteId } = await request.json();
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  const result = await structureNote(supabase, noteId);

  if (!result.success) {
    const status =
      result.error === "Note not found" || result.error === "Resident not found"
        ? 404
        : 500;
    return NextResponse.json(
      { error: "Failed to structure note", details: result.error },
      { status }
    );
  }

  return NextResponse.json({ structured: result.structured });
}
