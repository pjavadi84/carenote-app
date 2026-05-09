# Pre-Pilot Correctness Fixes — Two Gaps

> **Status:** Plan only — not yet implemented. Drafted 2026-05-09 for the Taiwan pilot kickoff.
> **Owner:** Pouya
> **Implement after:** Taiwan deployment is verified end-to-end (signup, login, voice call, clinician share).
> **Implement before:** Quality / hallucination dashboard work.

---

## Context

Before any quality dashboard ships for the Taiwan pilot, two correctness gaps in the existing pipeline must be closed. Both were uncovered while planning the dashboard but are **prerequisites, not metrics** — a dashboard that *reports* drift is less useful than fixes that *prevent* drift.

**Gap 1 — `edited_output` is honored in some places and silently ignored in others.** The intent of `notes.edited_output` is "caregiver's correction wins." That intent holds in the in-app UI and the resident-summary readback, but breaks at three of the four surfaces that leave the building (clinician summary, family update, weekly summary) plus the voice-call grounding context. For the Taiwan surgeon receiving a `zh-TW` clinical summary, this means the document he reads can disagree with the version visible in the app — exactly the kind of inconsistency that erodes trust in the pilot.

**Gap 2 — `is_structured = false` is a silent quality failure.** A note whose Claude call failed is invisible to all three outbound surfaces (no JSON to parse → `disclosure_class` filter excludes it). The caregiver entered an observation; the family and clinician never see it. This is categorically different from hallucination — there is no draft to edit. The dashboard should treat `is_edited` (organic hallucination signal) and `structuring_error` (pipeline-failure signal) as separate metrics with different remediation paths. The fix is auto-retry + a manual surface for permanently-stuck notes; the dashboard then tracks the residual.

Both fixes are small, scoped, and unblock the broader dashboard work.

---

## Gap 1 — Make outbound surfaces respect `edited_output`

### The four sites

| File | Line | Current behavior | Fix |
|---|---|---|---|
| `src/app/api/share/clinician/route.ts` | `162`, `217` | SELECT `structured_output`, parse | Also SELECT `edited_output`; use shared helper to pick edited if present |
| `src/app/api/claude/family-update/route.ts` | `85`, `125` | Same | Same |
| `src/lib/jobs/weekly-summaries.ts` | `80`, `115` | Same | Same |
| `src/app/api/voice/start/route.ts` | `163`, `170` | Recent-notes grounding ignores corrections | Same |

### Implementation

**New helper** `src/lib/notes/effective-output.ts`:

```ts
export interface NoteOutputColumns {
  structured_output: string | null;
  edited_output: string | null;
}

export function getEffectiveStructuredOutput(
  note: NoteOutputColumns
): string | null {
  return note.edited_output ?? note.structured_output;
}
```

Tiny — 6 lines of code, but having a single name makes the intent grep-able and any future audit one search away. Mirrors the existing read pattern at `src/app/api/residents/[id]/summary/route.ts:194`.

**Apply at the four sites:**

1. Add `edited_output` to each `.select()` call.
2. Replace `n.structured_output` with `getEffectiveStructuredOutput(n)` at the parse / serialize step.
3. Where the call site forwards `structured_output` to a prompt builder (e.g., `family-update/route.ts:138`, `clinician/route.ts:227`), forward the resolved value, not the raw column.

### Tests

`src/lib/notes/__tests__/effective-output.test.ts` (new):

- Returns `edited_output` when both columns are non-null
- Returns `structured_output` when `edited_output` is null
- Returns null when both are null

Update existing tests at the four sites if any assert on `structured_output` directly:

- `src/app/api/claude/family-update/__tests__/` — add a case where a sampled note has `edited_output != structured_output`; assert the prompt body contains the edited content.
- `src/app/api/share/clinician/__tests__/` — same.
- `src/lib/jobs/__tests__/weekly-summaries.test.ts` if it exists — same.
- `src/app/api/voice/start/__tests__/` — same.

### Out of scope (called out so it doesn't get folded in here)

- **Resending family updates after a late edit.** This would be a notification or a versioned-update mechanism. Worth tracking, but a separate change. For now, document the limitation in a code comment at the family-update call site so it's discoverable.

---

## Gap 2 — Auto-retry + visible "stuck" notes for failed structuring

### Schema additions

**`supabase/migrations/00019_structuring_attempts.sql`** (new):

```sql
ALTER TABLE notes
  ADD COLUMN structuring_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN structuring_giving_up BOOLEAN NOT NULL DEFAULT false;

-- Tighten the existing pending-structuring index to include the new fields
DROP INDEX IF EXISTS idx_notes_pending_structuring;
CREATE INDEX idx_notes_pending_structuring
  ON notes (is_structured, structuring_giving_up, last_structuring_attempt_at)
  WHERE is_structured = false AND structuring_giving_up = false;
```

`structuring_attempts` increments every time the structuring path runs (success path resets to its current value, failure path increments). `structuring_giving_up` flips to `true` after attempts ≥ 5, and the auto-retry stops touching the row — manual intervention only.

The existing `last_structuring_attempt_at` and `structuring_error` columns are reused as-is; the migration is purely additive.

### Refactor: extract structuring logic into a shared function

Today the entire structuring flow lives inline in `src/app/api/claude/structure/route.ts:68-142` (the POST handler). The cron cannot call the route directly (it's user-authenticated and quota-gated). Pull the core into a service:

**`src/lib/services/structure-note.ts`** (new):

```ts
export interface StructureNoteResult {
  success: boolean;
  error?: string;
  retryable: boolean;
}

export async function structureNote(
  supabase: SupabaseClient,
  noteId: string,
  options: { skipQuota?: boolean } = {}
): Promise<StructureNoteResult>;
```

The service:

- Increments `structuring_attempts` and sets `last_structuring_attempt_at` before the Claude call (so observability holds even if the process crashes mid-call).
- On success: clears `structuring_error`, sets `is_structured = true`, persists `structured_output` / metadata.
- On failure: writes `structuring_error`. If `attempts >= 5`, sets `structuring_giving_up = true`.
- Classifies errors as `retryable` (rate-limit, network) vs `non-retryable` (parse-error, schema-mismatch). Non-retryable gives up immediately, regardless of attempt count.

Then the existing route at `src/app/api/claude/structure/route.ts` becomes a thin wrapper: auth + quota + call `structureNote(supabase, noteId)`. Same external contract. The voice webhook structuring branch at `src/app/api/voice/webhook/route.ts:225-250` can also call this service rather than duplicating logic.

### Auto-retry cron

**`src/app/api/cron/retry-failed-structuring/route.ts`** (new):

```
GET handler, gated by Bearer ${CRON_SECRET}.
1. Query notes WHERE is_structured = false
                 AND structuring_giving_up = false
                 AND (last_structuring_attempt_at IS NULL
                      OR last_structuring_attempt_at < now() - interval '5 minutes')
                 AND structuring_attempts < 5
   LIMIT 50.
2. Use service-role Supabase client (cron has no user). Bypass quota.
3. For each row: call structureNote(serviceSupabase, row.id, { skipQuota: true }).
4. Sequentially with a small delay between calls (200ms) to avoid Anthropic rate limits.
5. Return JSON: { processed: N, succeeded: X, failed: Y, gave_up: Z }.
```

Run every 15 minutes. Backoff is implicit via the `last_structuring_attempt_at < now() - interval '5 minutes'` filter — a row that just failed waits at least 5 min before re-runs. With `attempts < 5` and 5+ min between attempts, a row gets max ~5 retries before giving up.

### Vercel cron registration

Today `vercel.json` is `{}`. Wire the cron there (`vercel.ts` is the newer pattern, but `vercel.json` works and avoids a new dep mid-pilot):

**`vercel.json`**:

```json
{
  "crons": [
    {
      "path": "/api/cron/retry-failed-structuring",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Existing weekly-summaries cron is currently triggered by `CRON_SECRET` but has no schedule entry — leaving that alone for this change; add in a follow-up.

### Manual "retry now" surface

A retry cron handles transient failures, but there will still be permanently-stuck notes (`giving_up = true`, hard parse errors, etc.). Surface them so an admin can act:

**`src/app/(dashboard)/dashboard/page.tsx`** (modify, not new): Add a "Stuck notes" stat card to the existing admin dashboard — count of notes where `is_structured = false`. Click-through goes to a new admin surface:

**`src/app/(dashboard)/notes/stuck/page.tsx`** (new, admin-only via `requireAdmin()`):

- Lists rows with `is_structured = false`, ordered by `last_structuring_attempt_at` desc.
- Shows: caregiver, resident, raw_input excerpt, last error, attempt count, giving_up flag.
- Action per row: **Retry now** (resets `structuring_giving_up` if true, calls the retry endpoint).

**`src/app/api/claude/structure/[noteId]/retry/route.ts`** (new): POST endpoint, admin-only. Resets `structuring_attempts = 0` and `structuring_giving_up = false`, then calls `structureNote()`. Logs an `audit_events` row (`event_type: 'note_retry_structuring'`).

### Tests

- `src/lib/services/__tests__/structure-note.test.ts` (new): success path, retryable failure increments attempts, non-retryable failure flips `giving_up` immediately, attempts ≥ 5 flips `giving_up`.
- `src/app/api/cron/retry-failed-structuring/__tests__/route.test.ts` (new): auth gate, picks correct rows, respects 5-min cooldown, gives up at 5 attempts.
- E2E in `e2e/`: create a note, force structuring failure (mock Anthropic to reject), wait for cron, confirm retry happens, then succeed and confirm `is_structured = true`.

---

## Files Summary

### New

- `src/lib/notes/effective-output.ts`
- `src/lib/notes/__tests__/effective-output.test.ts`
- `src/lib/services/structure-note.ts`
- `src/lib/services/__tests__/structure-note.test.ts`
- `src/app/api/cron/retry-failed-structuring/route.ts`
- `src/app/api/cron/retry-failed-structuring/__tests__/route.test.ts`
- `src/app/api/claude/structure/[noteId]/retry/route.ts`
- `src/app/(dashboard)/notes/stuck/page.tsx`
- `supabase/migrations/00019_structuring_attempts.sql`

### Modified

- `src/app/api/claude/structure/route.ts` — refactor to thin wrapper around `structureNote()` service
- `src/app/api/voice/webhook/route.ts` — call `structureNote()` instead of inline duplicate
- `src/app/api/share/clinician/route.ts` — add `edited_output` to select; use `getEffectiveStructuredOutput()`
- `src/app/api/claude/family-update/route.ts` — same
- `src/lib/jobs/weekly-summaries.ts` — same
- `src/app/api/voice/start/route.ts` — same
- `src/app/(dashboard)/dashboard/page.tsx` — add Stuck-notes stat card
- `vercel.json` — register new cron
- `src/types/database.ts` — regenerate via `pnpm db:types` after migration

### Reused (do not reinvent)

- `requireAdmin()` at `src/lib/auth.ts:41-47` for admin gating
- `logAudit()` at `src/lib/audit.ts` for retry-action audit trail
- `callClaude` + `parseJsonResponse` from `src/lib/claude.ts` (already used inline in route)
- `idx_notes_pending_structuring` index (replaced by tightened version)

---

## Verification

### Gap 1

1. Local: create a note, structure it via `/api/claude/structure`, then edit `edited_output` in the in-app UI (or via Studio).
2. Trigger a family update for that resident → assert the email body uses the edited text, not the original LLM text.
3. Generate a clinician share for that resident → assert the PDF/email body uses the edited text.
4. Trigger weekly-summaries cron locally → assert the summary references edited content.
5. Start a new voice call for the resident → inspect `assistantOverrides.variableValues.recent_notes_summary` → assert it pulled from the edited version.
6. Run `pnpm test` — all four call-site tests pass with the new "edited differs from structured" case.

### Gap 2

1. `pnpm db:migrate` → confirm migration 00019 applies; `notes.structuring_attempts` defaults to 0.
2. Force a structuring failure: mock `callClaude` to throw (or temporarily unset `ANTHROPIC_API_KEY`); create a note; observe `is_structured = false`, `structuring_attempts = 1`, `structuring_error` populated.
3. Wait 5+ minutes (or seed `last_structuring_attempt_at` to past) and trigger the cron locally:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
        http://localhost:3000/api/cron/retry-failed-structuring
   ```

4. With Anthropic still mocked-failing: confirm `attempts` increments to 2; eventually flips `structuring_giving_up = true` at attempts ≥ 5.
5. Restore Anthropic, hit `/api/claude/structure/<noteId>/retry` as admin → confirm note succeeds, both flags reset, `is_structured = true`.
6. Open `/notes/stuck` as admin → confirm stuck notes list renders; confirm caregiver login redirects to `/today` (existing `requireAdmin()` behavior).
7. Run `pnpm test` and `pnpm test:e2e` — new tests pass.
8. Confirm `vercel.json` cron lands in the next preview deployment (`vercel inspect` or dashboard).

### End-to-end pre-pilot smoke

- Real flow with the Taiwan deployment: caregiver creates a Vietnamese voice note → structuring succeeds → caregiver edits the structured output in-app → clinician share generated → confirm the surgeon's `zh-TW` summary contains the edited content.
- Force a structuring failure on a real note → wait 15 min → confirm cron auto-retries, succeeds, and the note then flows through clinician share normally.

---

## Implementation order (when picked up)

1. **Gap 1 first** — it's a smaller, lower-risk change (no schema, no cron) and addresses the higher-stakes drift (clinician summary going to a doctor).
2. **Then Gap 2 schema + service refactor** — the service extraction makes both the route and the cron simpler.
3. **Then the cron + Vercel registration** — fully behind a feature flag for the first 24h on prod (env var gate inside the cron handler) so a buggy retry loop can be killed without redeploy.
4. **Then the admin "Stuck notes" surface** — UI is the lowest risk; nice to have it last so it can show real data immediately.

Each step is independently shippable. Don't bundle them.
