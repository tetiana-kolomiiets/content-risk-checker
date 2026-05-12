-- Enable pgvector for AiAnalysisMemory.embedding (vector(1536)).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ContentRiskCheckStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentRiskSourceType" AS ENUM ('PLAIN_TEXT');

-- CreateEnum
CREATE TYPE "ContentRiskStepName" AS ENUM ('NORMALIZE_TEXT', 'DETECT_DUPLICATE', 'RUN_RULE_BASED_CHECKS', 'RETRIEVE_AI_CONTEXT', 'RUN_AI_ANALYSIS', 'AGGREGATE_RESULT', 'PERSIST_AI_MEMORY');

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
    "traceId" TEXT NOT NULL,
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
    "duplicateOfCheckId" TEXT,
    "promptVersionId" TEXT,
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
    "traceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysisMemory" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "contentSnippet" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "finalRiskLevel" "ContentRiskLevel" NOT NULL,
    "categories" "ContentRiskCategory"[],
    "rationale" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysisMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentRiskCheck_requestId_idx" ON "ContentRiskCheck"("requestId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_traceId_idx" ON "ContentRiskCheck"("traceId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_contentHash_promptVersionId_idx" ON "ContentRiskCheck"("contentHash", "promptVersionId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_status_idx" ON "ContentRiskCheck"("status");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_status_currentStep_idx" ON "ContentRiskCheck"("status", "currentStep");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_replayOfCheckId_idx" ON "ContentRiskCheck"("replayOfCheckId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_duplicateOfCheckId_idx" ON "ContentRiskCheck"("duplicateOfCheckId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRiskAnalysisResult_checkId_key" ON "ContentRiskAnalysisResult"("checkId");

-- CreateIndex
CREATE INDEX "ContentRiskAnalysisResult_finalRiskLevel_idx" ON "ContentRiskAnalysisResult"("finalRiskLevel");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_checkId_idx" ON "ContentRiskStepLog"("checkId");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_checkId_stepName_idx" ON "ContentRiskStepLog"("checkId", "stepName");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_traceId_idx" ON "ContentRiskStepLog"("traceId");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_status_idx" ON "ContentRiskStepLog"("status");

-- CreateIndex
CREATE INDEX "Prompt_name_isActive_idx" ON "Prompt"("name", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_name_version_key" ON "Prompt"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysisMemory_checkId_key" ON "AiAnalysisMemory"("checkId");

-- CreateIndex
CREATE INDEX "AiAnalysisMemory_promptVersionId_createdAt_idx" ON "AiAnalysisMemory"("promptVersionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentRiskCheck" ADD CONSTRAINT "ContentRiskCheck_replayOfCheckId_fkey" FOREIGN KEY ("replayOfCheckId") REFERENCES "ContentRiskCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskCheck" ADD CONSTRAINT "ContentRiskCheck_duplicateOfCheckId_fkey" FOREIGN KEY ("duplicateOfCheckId") REFERENCES "ContentRiskCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskCheck" ADD CONSTRAINT "ContentRiskCheck_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskAnalysisResult" ADD CONSTRAINT "ContentRiskAnalysisResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRiskStepLog" ADD CONSTRAINT "ContentRiskStepLog_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisMemory" ADD CONSTRAINT "AiAnalysisMemory_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisMemory" ADD CONSTRAINT "AiAnalysisMemory_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HNSW index for cosine-similarity ANN search on AiAnalysisMemory.embedding.
-- Prisma's @@index does not support index methods (hnsw/ivfflat) or operator
-- classes (vector_cosine_ops), so this is created in raw SQL.
CREATE INDEX "ai_analysis_memory_embedding_hnsw_idx"
ON "AiAnalysisMemory"
USING hnsw (embedding vector_cosine_ops);

-- Idempotency guard: at most one canonical (non-duplicate) COMPLETED check per
-- (contentHash, promptVersionId). Duplicates and replays carry duplicateOfCheckId
-- and are excluded from the constraint.
CREATE UNIQUE INDEX "uq_completed_check_per_hash_prompt"
  ON "ContentRiskCheck" ("contentHash", "promptVersionId")
  WHERE "status" = 'COMPLETED' AND "duplicateOfCheckId" IS NULL;
