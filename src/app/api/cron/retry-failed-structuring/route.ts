import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  structureNote,
  MAX_STRUCTURING_ATTEMPTS,
} from "@/lib/services/structure-note";

// Auto-retry for notes whose initial structuring failed. See Gap 2 in
// docs/PRE-PILOT-CORRECTNESS-FIXES.md.
//
// Hot path stays small via the partial index added in migration 00019. The
// 5-minute cooldown is enforced inline (not via the index) so we don't have
// to materialize a NOW() expression in a partial-index predicate.
//
// Gated behind RETRY_FAILED_STRUCTURING_ENABLED so a runaway retry loop can
// be killed without redeploy. Default off; flip to "true" after the first
// 24 hours on prod look healthy.

const COOLDOWN_MS = 5 * 60 * 1000; // 5 min between retries on the same note
const BATCH_LIMIT = 50;
const PER_NOTE_DELAY_MS = 200; // Anthropic rate-limit pacing

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.RETRY_FAILED_STRUCTURING_ENABLED !== "true") {
    return NextResponse.json({
      skipped: true,
      reason: "RETRY_FAILED_STRUCTURING_ENABLED is not 'true'",
    });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();

  const { data: rows, error } = await supabase
    .from("notes")
    .select("id, structuring_attempts")
    .eq("is_structured", false)
    .eq("structuring_giving_up", false)
    .lt("structuring_attempts", MAX_STRUCTURING_ATTEMPTS)
    .or(
      `last_structuring_attempt_at.is.null,last_structuring_attempt_at.lt.${cutoff}`
    )
    .order("last_structuring_attempt_at", {
      ascending: true,
      nullsFirst: true,
    })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  const candidates = (rows ?? []) as Array<{
    id: string;
    structuring_attempts: number;
  }>;

  let succeeded = 0;
  let failed = 0;
  let gaveUp = 0;

  for (const row of candidates) {
    const result = await structureNote(supabase, row.id);
    if (result.success) succeeded++;
    else failed++;
    if (result.gaveUp) gaveUp++;
    if (PER_NOTE_DELAY_MS > 0) await sleep(PER_NOTE_DELAY_MS);
  }

  return NextResponse.json({
    processed: candidates.length,
    succeeded,
    failed,
    gave_up: gaveUp,
  });
}
