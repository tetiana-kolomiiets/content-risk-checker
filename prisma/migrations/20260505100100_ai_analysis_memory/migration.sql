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
CREATE UNIQUE INDEX "AiAnalysisMemory_checkId_key" ON "AiAnalysisMemory"("checkId");

-- CreateIndex
CREATE INDEX "AiAnalysisMemory_promptVersionId_createdAt_idx" ON "AiAnalysisMemory"("promptVersionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAnalysisMemory" ADD CONSTRAINT "AiAnalysisMemory_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContentRiskCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysisMemory" ADD CONSTRAINT "AiAnalysisMemory_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
