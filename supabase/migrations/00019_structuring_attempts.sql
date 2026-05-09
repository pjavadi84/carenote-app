-- Gap 2 from docs/PRE-PILOT-CORRECTNESS-FIXES.md: a Claude structuring failure
-- silently strands the note (is_structured=false → excluded from clinician
-- summaries, family updates, weekly summaries). Today there's no auto-retry
-- and no admin surface listing stuck notes; the caregiver believes she logged
-- the observation, the surgeon never sees it.
--
-- This migration is purely additive:
--   structuring_attempts      — incremented on every structuring run.
--   structuring_giving_up     — set true after attempts >= 5 (or non-retryable
--                               error class), at which point the auto-retry
--                               cron stops touching the row; manual admin
--                               intervention only.
--
-- The existing partial index on (is_structured, last_structuring_attempt_at)
-- WHERE is_structured = false is replaced with one that also filters out the
-- gave-up rows so the cron's hot path stays small as the giving-up pile grows.

ALTER TABLE notes
  ADD COLUMN structuring_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN structuring_giving_up BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_notes_pending_structuring;
CREATE INDEX idx_notes_pending_structuring
  ON notes (is_structured, structuring_giving_up, last_structuring_attempt_at)
  WHERE is_structured = false AND structuring_giving_up = false;
