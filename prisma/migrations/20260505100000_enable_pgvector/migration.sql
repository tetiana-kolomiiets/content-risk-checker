-- Enable pgvector for AiAnalysisMemory.embedding (vector(1536)).
-- Must run before the AiAnalysisMemory table migration that uses the vector type.
CREATE EXTENSION IF NOT EXISTS vector;
