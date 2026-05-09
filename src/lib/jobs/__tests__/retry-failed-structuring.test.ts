import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));

const mockSelectChain = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelectChain }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/services/structure-note", () => ({
  MAX_STRUCTURING_ATTEMPTS: 5,
  structureNote: vi.fn(),
}));

import { structureNote } from "@/lib/services/structure-note";
import { runRetryFailedStructuring } from "@/lib/jobs/retry-failed-structuring";

const ORIGINAL_ENV = { ...process.env };

function stubQueryReturning(rows: Array<{ id: string; structuring_attempts: number }>) {
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

describe("runRetryFailedStructuring", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "true";
    vi.mocked(structureNote).mockReset();
    mockFrom.mockClear();
    mockSelectChain.mockReset();
  });

  it("short-circuits with skipped=true when the feature flag is unset", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "";
    const result = await runRetryFailedStructuring();
    expect(result.skipped).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("short-circuits with skipped=true when the feature flag is 'false'", async () => {
    process.env.RETRY_FAILED_STRUCTURING_ENABLED = "false";
    const result = await runRetryFailedStructuring();
    expect(result.skipped).toBe(true);
  });

  it("returns processed=0 when no candidates", async () => {
    stubQueryReturning([]);
    const result = await runRetryFailedStructuring();
    expect(result).toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      gave_up: 0,
    });
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

    const result = await runRetryFailedStructuring();

    expect(result).toEqual({
      processed: 3,
      succeeded: 1,
      failed: 2,
      gave_up: 1,
    });
    expect(structureNote).toHaveBeenCalledTimes(3);
  });
});
