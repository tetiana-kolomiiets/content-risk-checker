-- Replay-aware idempotency guard: at most one canonical (non-replay) COMPLETED check
-- per (contentHash, promptVersionId). Replays (replayOfCheckId IS NOT NULL) are
-- excluded so a check can be replayed any number of times without colliding with
-- the original or with prior replays.
DROP INDEX IF EXISTS "uq_completed_check_per_hash_prompt";
CREATE UNIQUE INDEX "uq_completed_check_per_hash_prompt"
  ON "ContentRiskCheck" ("contentHash", "promptVersionId")
  WHERE "status" = 'COMPLETED' AND "replayOfCheckId" IS NULL;
