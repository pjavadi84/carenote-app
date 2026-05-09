import { createAdminClient } from "@/lib/supabase/admin";
import {
  structureNote,
  MAX_STRUCTURING_ATTEMPTS,
} from "@/lib/services/structure-note";

// Auto-retry batch for notes whose initial structuring failed. See Gap 2 in
// docs/PRE-PILOT-CORRECTNESS-FIXES.md. Triggered every 15 minutes by
// retryFailedStructuringCron in src/lib/inngest/functions.ts; also reachable
// for manual triggering via the /api/cron/retry-failed-structuring HTTP
// route (Bearer-token gated).
//
// The hot path stays small via the partial index added in migration 00019.
// The 5-minute cooldown is enforced inline (not via the index) so we don't
// have to materialize a NOW() expression in a partial-index predicate.

const COOLDOWN_MS = 5 * 60 * 1000;
const BATCH_LIMIT = 50;
const PER_NOTE_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RunRetryResult {
  processed: number;
  succeeded: number;
  failed: number;
  gave_up: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export async function runRetryFailedStructuring(): Promise<RunRetryResult> {
  // Feature flag: ship disarmed. Flip RETRY_FAILED_STRUCTURING_ENABLED=true
  // after the first 24 h on prod look healthy. Both the Inngest schedule and
  // the HTTP route consult this same flag so they cannot diverge.
  if (process.env.RETRY_FAILED_STRUCTURING_ENABLED !== "true") {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      gave_up: 0,
      skipped: true,
      reason: "RETRY_FAILED_STRUCTURING_ENABLED is not 'true'",
    };
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
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      gave_up: 0,
      error: error.message,
    };
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

  return {
    processed: candidates.length,
    succeeded,
    failed,
    gave_up: gaveUp,
  };
}
