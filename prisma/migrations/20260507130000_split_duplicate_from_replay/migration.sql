-- Split the overloaded "replayOfCheckId" into two columns with distinct semantics:
--   * replayOfCheckId    — set ONLY by user-triggered replay (POST /:id/replay).
--   * duplicateOfCheckId — set by the pipeline when DetectDuplicate finds an
--                          existing canonical, OR when finalize loses the
--                          unique-index race and adopts the winner's result.
-- The unique partial index that guards "one canonical COMPLETED per
-- (contentHash, promptVersionId)" moves from "replayOfCheckId IS NULL" to
-- "duplicateOfCheckId IS NULL" — the actual non-canonical predicate.

ALTER TABLE "ContentRiskCheck" ADD COLUMN "duplicateOfCheckId" TEXT;

ALTER TABLE "ContentRiskCheck"
  ADD CONSTRAINT "ContentRiskCheck_duplicateOfCheckId_fkey"
  FOREIGN KEY ("duplicateOfCheckId") REFERENCES "ContentRiskCheck"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContentRiskCheck_duplicateOfCheckId_idx"
  ON "ContentRiskCheck"("duplicateOfCheckId");

DROP INDEX IF EXISTS "uq_completed_check_per_hash_prompt";
CREATE UNIQUE INDEX "uq_completed_check_per_hash_prompt"
  ON "ContentRiskCheck" ("contentHash", "promptVersionId")
  WHERE "status" = 'COMPLETED' AND "duplicateOfCheckId" IS NULL;
