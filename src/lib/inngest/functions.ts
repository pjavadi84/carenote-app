import { inngest } from "./client";
import { runWeeklySummaries } from "@/lib/jobs/weekly-summaries";

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
