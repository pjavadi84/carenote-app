import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));

vi.mock("@/lib/jobs/retry-failed-structuring", () => ({
  runRetryFailedStructuring: vi.fn(),
}));

import { NextRequest } from "next/server";
import { runRetryFailedStructuring } from "@/lib/jobs/retry-failed-structuring";
import { GET } from "@/app/api/cron/retry-failed-structuring/route";

const ORIGINAL_ENV = { ...process.env };

function makeRequest(authorization?: string): NextRequest {
  const url = "http://localhost/api/cron/retry-failed-structuring";
  return new NextRequest(url, {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/retry-failed-structuring", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.CRON_SECRET = "secret";
    vi.mocked(runRetryFailedStructuring).mockReset();
  });

  it("rejects calls without the cron bearer token", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(runRetryFailedStructuring).not.toHaveBeenCalled();
  });

  it("rejects calls with a wrong bearer token", async () => {
    const res = await GET(makeRequest("Bearer not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("returns the job result on success", async () => {
    vi.mocked(runRetryFailedStructuring).mockResolvedValue({
      processed: 3,
      succeeded: 1,
      failed: 2,
      gave_up: 1,
    });
    const res = await GET(makeRequest("Bearer secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      processed: 3,
      succeeded: 1,
      failed: 2,
      gave_up: 1,
    });
  });

  it("relays the job's skipped result when the feature flag is off", async () => {
    vi.mocked(runRetryFailedStructuring).mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      gave_up: 0,
      skipped: true,
      reason: "RETRY_FAILED_STRUCTURING_ENABLED is not 'true'",
    });
    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it("returns 500 when the job reports a query error", async () => {
    vi.mocked(runRetryFailedStructuring).mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      gave_up: 0,
      error: "boom",
    });
    const res = await GET(makeRequest("Bearer secret"));
    expect(res.status).toBe(500);
  });
});
