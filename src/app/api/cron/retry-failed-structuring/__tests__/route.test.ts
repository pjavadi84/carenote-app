import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));

const mockSelectChain = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelectChain,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/services/structure-note", () => ({
  MAX_STRUCTURING_ATTEMPTS: 5,
  structureNote: vi.fn(),
}));

import { NextRequest } from "next/server";
import { structureNote } from "@/lib/services/structure-note";
import { GET } from "@/app/api/cron/retry-failed-structuring/route";

const ORIGINAL_ENV = { ...process.env };

function makeRequest(authorization?: string): NextRequest {
  const url = "http://localhost/api/cron/retry-failed-structuring";
  return new NextRequest(url, {
    headers: authorization ? { authorization } : {},
  });
}

function stubQueryReturning(rows: Array<{ id: string; structuring_attempts: number }>) {
  // Returns the chain shape the route consumes:
  // .select(...).eq(...).eq(...).lt(...).or(...).order(...).limit(...)
  const final = { data: rows, error: null };
  mockSelectChain.mockReset();
  mockSelectChain.mockReturnValue({
    eq: () => ({
      eq: () => ({
        lt: () => ({
          or: () => ({
            order: () => ({
              limit: () => Promise.resolve(final),
            }),
          }),
        }),
      }),
    }),
  });
}

describe("GET /api/cron/retry-failed-structuring", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.CRON_SECRET = "secret";
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";
    vi.mocked(structureNote).mockReset();
    mockFrom.mockClear();
  });

  it("rejects calls without the cron bearer token", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects calls with a wrong bearer token", async () => {
    const res = await GET(makeRequest("Bearer not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("short-circuits with skipped=true when feature flag is unset", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "";
    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("short-circuits with skipped=true when feature flag is 'false'", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "false";
    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it("returns processed=0 when no candidates", async () => {
    stubQueryReturning([]);
    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();
    expect(body).toEqual({ processed: 0, succeeded: 0, failed: 0, gave_up: 0 });
    expect(structureNote).not.toHaveBeenCalled();
  });

  it("calls structureNote per candidate and aggregates results", async () => {
    stubQueryReturning([
      { id: "n1", structuring_attempts: 1 },
      { id: "n2", structuring_attempts: 2 },
      { id: "n3", structuring_attempts: 4 },
    ]);
    vi.mocked(structureNote)
      .mockResolvedValueOnce({
        success: true,
        retryable: false,
        attempts: 2,
        gaveUp: false,
      })
      .mockResolvedValueOnce({
        success: false,
        error: "rate limit",
        retryable: true,
        attempts: 3,
        gaveUp: false,
      })
      .mockResolvedValueOnce({
        success: false,
        error: "rate limit",
        retryable: true,
        attempts: 5,
        gaveUp: true,
      });

    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();

    expect(body).toEqual({
      processed: 3,
      succeeded: 1,
      failed: 2,
      gave_up: 1,
    });
    expect(structureNote).toHaveBeenCalledTimes(3);
  });
});
