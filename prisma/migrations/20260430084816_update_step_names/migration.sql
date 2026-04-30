-- AlterEnum
BEGIN;
CREATE TYPE "ContentRiskStepName_new" AS ENUM ('NORMALIZE_TEXT', 'DETECT_DUPLICATE', 'RUN_RULE_BASED_CHECKS', 'RUN_AI_ANALYSIS', 'AGGREGATE_RESULT');
ALTER TABLE "ContentRiskCheck" ALTER COLUMN "currentStep" TYPE "ContentRiskStepName_new" USING ("currentStep"::text::"ContentRiskStepName_new");
ALTER TABLE "ContentRiskStepLog" ALTER COLUMN "stepName" TYPE "ContentRiskStepName_new" USING ("stepName"::text::"ContentRiskStepName_new");
ALTER TYPE "ContentRiskStepName" RENAME TO "ContentRiskStepName_old";
ALTER TYPE "ContentRiskStepName_new" RENAME TO "ContentRiskStepName";
DROP TYPE "ContentRiskStepName_old";
COMMIT;
