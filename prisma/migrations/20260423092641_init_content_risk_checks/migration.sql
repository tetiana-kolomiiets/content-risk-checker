-- CreateEnum
CREATE TYPE "ContentRiskCheckStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentRiskSourceType" AS ENUM ('PLAIN_TEXT');

-- CreateEnum
CREATE TYPE "ContentRiskStepName" AS ENUM ('VALIDATE_INPUT', 'NORMALIZE_TEXT', 'SAVE_RAW_INPUT', 'RUN_RULE_BASED_CHECKS', 'DERIVE_RISK_LEVEL', 'SAVE_RESULT');

-- CreateEnum
CREATE TYPE "ContentRiskCategory" AS ENUM ('TOXICITY', 'HARASSMENT', 'HATE', 'THREAT', 'SELF_HARM', 'SEXUAL_CONTENT', 'SPAM', 'SCAM', 'MISINFORMATION');

-- CreateEnum
CREATE TYPE "ContentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "StepExecutionStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ContentRiskCheck" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceType" "ContentRiskSourceType" NOT NULL DEFAULT 'PLAIN_TEXT',
    "status" "ContentRiskCheckStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" "ContentRiskStepName",
    "contentHash" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "replayOfCheckId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRiskCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRiskAnalysisResult" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "finalRiskLevel" "ContentRiskLevel" NOT NULL,
    "categories" "ContentRiskCategory"[],
    "matchedRulesCount" INTEGER NOT NULL DEFAULT 0,
    "totalRulesChecked" INTEGER NOT NULL DEFAULT 0,
    "flaggedFragments" JSONB NOT NULL,
    "matchedRules" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRiskAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRiskStepLog" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "stepName" "ContentRiskStepName" NOT NULL,
    "status" "StepExecutionStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "errorMessage" TEXT,
    "details" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRiskStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentRiskCheck_requestId_idx" ON "ContentRiskCheck"("requestId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_contentHash_idx" ON "ContentRiskCheck"("contentHash");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_status_idx" ON "ContentRiskCheck"("status");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_status_currentStep_idx" ON "ContentRiskCheck"("status", "currentStep");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_replayOfCheckId_idx" ON "ContentRiskCheck"("replayOfCheckId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRiskAnalysisResult_checkId_key" ON "ContentRiskAnalysisResult"("checkId");

-- CreateIndex
CREATE INDEX "ContentRiskAnalysisResult_finalRiskLevel_idx" ON "ContentRiskAnalysisResult"("finalRiskLevel");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_checkId_idx" ON "ContentRiskStepLog"("checkId");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_checkId_stepName_idx" ON "ContentRiskStepLog"("checkId", "stepName");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_status_idx" ON "ContentRiskStepLog"("status");

-- AddForeignKey
ALTER TABLE "ContentRiskCheck" ADD CONSTRAINT "ContentRiskCheck_replayOfCheckId_fkey" FOREIGN KEY ("replayOfCheckId") REFERENCES "ContentRiskCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskAnalysisResult" ADD CONSTRAINT "ContentRiskAnalysisResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskStepLog" ADD CONSTRAINT "ContentRiskStepLog_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
