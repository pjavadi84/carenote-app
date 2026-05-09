import { NextRequest, NextResponse } from "next/server";
import { runRetryFailedStructuring } from "@/lib/jobs/retry-failed-structuring";

// HTTP entry-point for the auto-retry batch. The scheduled trigger is the
// Inngest function in src/lib/inngest/functions.ts; this route exists for
// manual triggering (curl with Bearer ${CRON_SECRET}) when debugging or
// re-running after a flag flip.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetryFailedStructuring();

  if (result.error) {
    return NextResponse.json(
      { error: "Query failed", details: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
