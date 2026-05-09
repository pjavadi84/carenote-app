import { inngest } from "./client";
import { runWeeklySummaries } from "@/lib/jobs/weekly-summaries";
import { runRetryFailedStructuring } from "@/lib/jobs/retry-failed-structuring";

// Hourly trigger. The job itself filters per-org for "Sunday 6 PM in this
// org's local time", so each timezone gets its summary once a week without
// needing per-org schedules.
export const weeklySummariesCron = inngest.createFunction(
  {
    id: "weekly-summaries",
    name: "Weekly summaries",
    triggers: [{ cron: "0 * * * *" }],
  },
  async () => runWeeklySummaries()
);

// Every-15-minutes auto-retry for notes whose Claude structuring failed.
// Vercel Hobby cron is daily-only, so we schedule this through Inngest
// alongside the weekly-summaries trigger. The job consults
// RETRY_FAILED_STRUCTURING_ENABLED internally and short-circuits when off.
export const retryFailedStructuringCron = inngest.createFunction(
  {
    id: "retry-failed-structuring",
    name: "Retry failed note structuring",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => runRetryFailedStructuring()
);
