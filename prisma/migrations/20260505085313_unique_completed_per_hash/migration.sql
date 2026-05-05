-- Idempotency guard: at most one canonical COMPLETED check per (contentHash, promptVersionId).
-- Replays (replayOfCheckId IS NOT NULL) are excluded so the race-fallback path can mark a
-- losing check COMPLETED-as-replay without violating the constraint.
-- PENDING/PROCESSING/FAILED rows are not indexed and do not conflict.
CREATE UNIQUE INDEX "uq_completed_check_per_hash_prompt"
  ON "ContentRiskCheck" ("contentHash", "promptVersionId")
  WHERE "status" = 'COMPLETED' AND "replayOfCheckId" IS NULL;
