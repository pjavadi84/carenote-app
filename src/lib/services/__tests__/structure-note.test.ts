import { describe, it, expect, vi, beforeEach } from "vitest";

// Anthropic SDK is mocked at the module level so importing claude.ts doesn't
// touch the real client. Individual tests then mock callClaude directly.
vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));
vi.mock("@/lib/claude", async () => {
  const actual = await vi.importActual<typeof import("@/lib/claude")>(
    "@/lib/claude"
  );
  return {
    ...actual,
    callClaude: vi.fn(),
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude } from "@/lib/claude";
import {
  structureNote,
  MAX_STRUCTURING_ATTEMPTS,
} from "@/lib/services/structure-note";

interface NoteFixture {
  id: string;
  raw_input: string;
  created_at: string;
  author_id: string;
  structuring_attempts: number;
  residents: {
    first_name: string;
    last_name: string;
    care_notes_context: string | null;
    conditions: string | null;
  };
}

const VALID_STRUCTURED_OUTPUT = JSON.stringify({
  summary: "Quiet shift.",
  sections: [
    {
      name: "Mood",
      content: "Calm and engaged.",
      disclosure_class: "family_shareable_by_involvement",
    },
  ],
  follow_up: "None.",
  flags: [],
  sensitive_flag: false,
  sensitive_category: null,
});

interface FakeState {
  note: NoteFixture;
  updates: Array<Record<string, unknown>>;
}

function fakeSupabase(state: FakeState): SupabaseClient {
  return {
    from(table: string) {
      if (table === "notes") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: { ...state.note, residents: state.note.residents },
                    error: null,
                  }),
                };
              },
            };
          },
          update(values: Record<string, unknown>) {
            state.updates.push(values);
            // Also reflect attempt-counter updates back into the fixture so a
            // later .single() (we don't have one but harmless) would see the
            // new value.
            if (typeof values.structuring_attempts === "number") {
              state.note.structuring_attempts = values.structuring_attempts;
            }
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "users") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: { full_name: "Alice" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

function makeNote(overrides: Partial<NoteFixture> = {}): NoteFixture {
  return {
    id: "note-1",
    raw_input: "Resident had a quiet morning.",
    created_at: "2026-05-09T08:00:00Z",
    author_id: "user-1",
    structuring_attempts: 0,
    residents: {
      first_name: "Mei",
      last_name: "Lin",
      care_notes_context: null,
      conditions: null,
    },
    ...overrides,
  };
}

describe("structureNote", () => {
  beforeEach(() => {
    vi.mocked(callClaude).mockReset();
  });

  it("success path: parses, persists, returns structured", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    vi.mocked(callClaude).mockResolvedValue(VALID_STRUCTURED_OUTPUT);

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.gaveUp).toBe(false);
    expect(result.structured?.summary).toBe("Quiet shift.");

    // Two writes: increment attempts, then success update.
    expect(state.updates).toHaveLength(2);
    expect(state.updates[0].structuring_attempts).toBe(1);
    expect(state.updates[1].is_structured).toBe(true);
    expect(state.updates[1].structuring_error).toBeNull();
    expect(state.updates[1].structuring_giving_up).toBe(false);
  });

  it("merges extraMetadata into final metadata on success", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    vi.mocked(callClaude).mockResolvedValue(VALID_STRUCTURED_OUTPUT);

    await structureNote(fakeSupabase(state), "note-1", {
      extraMetadata: { source: "voice_call", voice_session_id: "v-9" },
    });

    const meta = state.updates[1].metadata as Record<string, unknown>;
    expect(meta.source).toBe("voice_call");
    expect(meta.voice_session_id).toBe("v-9");
    expect(meta.model_used).toBe("claude-sonnet-4-6");
  });

  it("retryable failure: 429 rate limit increments attempts, does not give up", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    const err = new Error("rate limit") as Error & { status?: number };
    err.status = 429;
    vi.mocked(callClaude).mockRejectedValue(err);

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.gaveUp).toBe(false);
    expect(result.attempts).toBe(1);

    expect(state.updates).toHaveLength(2);
    expect(state.updates[1].is_structured).toBe(false);
    expect(state.updates[1].structuring_giving_up).toBe(false);
    expect(state.updates[1].structuring_error).toBe("rate limit");
  });

  it("non-retryable failure (parse error) flips giving_up immediately", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    vi.mocked(callClaude).mockResolvedValue("not json at all");

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.gaveUp).toBe(true);
    expect(result.attempts).toBe(1);

    expect(state.updates[1].structuring_giving_up).toBe(true);
  });

  it("non-retryable failure (4xx other than 429) flips giving_up immediately", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    const err = new Error("bad request") as Error & { status?: number };
    err.status = 400;
    vi.mocked(callClaude).mockRejectedValue(err);

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.retryable).toBe(false);
    expect(result.gaveUp).toBe(true);
  });

  it("retryable failure flips giving_up at MAX_STRUCTURING_ATTEMPTS", async () => {
    const state: FakeState = {
      note: makeNote({ structuring_attempts: MAX_STRUCTURING_ATTEMPTS - 1 }),
      updates: [],
    };
    const err = new Error("rate limit") as Error & { status?: number };
    err.status = 429;
    vi.mocked(callClaude).mockRejectedValue(err);

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.retryable).toBe(true);
    expect(result.attempts).toBe(MAX_STRUCTURING_ATTEMPTS);
    expect(result.gaveUp).toBe(true);
    expect(state.updates[1].structuring_giving_up).toBe(true);
  });

  it("network/timeout errors with no status are treated as retryable", async () => {
    const state: FakeState = { note: makeNote(), updates: [] };
    vi.mocked(callClaude).mockRejectedValue(new Error("fetch failed"));

    const result = await structureNote(fakeSupabase(state), "note-1");

    expect(result.retryable).toBe(true);
    expect(result.gaveUp).toBe(false);
  });
});
