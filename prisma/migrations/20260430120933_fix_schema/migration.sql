/*
  Warnings:

  - Added the required column `traceId` to the `ContentRiskCheck` table without a default value. This is not possible if the table is not empty.
  - Added the required column `traceId` to the `ContentRiskStepLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ContentRiskCheck_contentHash_idx";

-- AlterTable
ALTER TABLE "ContentRiskCheck" ADD COLUMN     "promptVersionId" TEXT,
ADD COLUMN     "traceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ContentRiskStepLog" ADD COLUMN     "traceId" TEXT NOT NULL;

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

-- CreateIndex
CREATE INDEX "Prompt_name_isActive_idx" ON "Prompt"("name", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_name_version_key" ON "Prompt"("name", "version");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_traceId_idx" ON "ContentRiskCheck"("traceId");

-- CreateIndex
CREATE INDEX "ContentRiskCheck_contentHash_promptVersionId_idx" ON "ContentRiskCheck"("contentHash", "promptVersionId");

-- CreateIndex
CREATE INDEX "ContentRiskStepLog_traceId_idx" ON "ContentRiskStepLog"("traceId");

-- AddForeignKey
ALTER TABLE "ContentRiskCheck" ADD CONSTRAINT "ContentRiskCheck_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
