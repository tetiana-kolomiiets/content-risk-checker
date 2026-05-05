-- HNSW index for cosine-similarity ANN search on AiAnalysisMemory.embedding.
-- Prisma's @@index does not support index methods (hnsw/ivfflat) or operator
-- classes (vector_cosine_ops), so this is created in a hand-written migration.
CREATE INDEX "ai_analysis_memory_embedding_hnsw_idx"
ON "AiAnalysisMemory"
USING hnsw (embedding vector_cosine_ops);
