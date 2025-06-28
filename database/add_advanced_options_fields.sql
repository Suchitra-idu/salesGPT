-- Migration: Add advanced options fields to projects table
-- This migration adds the dynamic parameters for advanced AI/retrieval options

-- Add new columns for advanced options
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS reranking_method TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS query_optimization TEXT DEFAULT 'semantic',
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS model_selection_type TEXT DEFAULT 'dropdown';

-- Add dynamic parameters for each advanced option
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS mmr_diversity DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS llm_reranking_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS window_size INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS summary_length INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS vector_similarity_threshold DECIMAL(3,2) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS hyde_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS hybrid_weight DECIMAL(3,2) DEFAULT 0.5;

-- Add constraints to ensure valid values
ALTER TABLE projects 
ADD CONSTRAINT check_reranking_method 
CHECK (reranking_method IN ('none', 'mmr', 'llm')),
ADD CONSTRAINT check_memory_type 
CHECK (memory_type IN ('none', 'window', 'summary', 'vector')),
ADD CONSTRAINT check_query_optimization 
CHECK (query_optimization IN ('semantic', 'hybrid', 'hyde')),
ADD CONSTRAINT check_model_selection_type
CHECK (model_selection_type IN ('dropdown', 'custom')),
ADD CONSTRAINT check_mmr_diversity 
CHECK (mmr_diversity >= 0 AND mmr_diversity <= 1),
ADD CONSTRAINT check_window_size 
CHECK (window_size >= 1 AND window_size <= 50),
ADD CONSTRAINT check_summary_length 
CHECK (summary_length >= 100 AND summary_length <= 1000),
ADD CONSTRAINT check_vector_similarity_threshold 
CHECK (vector_similarity_threshold >= 0 AND vector_similarity_threshold <= 1),
ADD CONSTRAINT check_hybrid_weight 
CHECK (hybrid_weight >= 0 AND hybrid_weight <= 1);

-- Add comments for documentation
COMMENT ON COLUMN projects.reranking_method IS 'Method used for re-ranking search results: none, mmr, or llm';
COMMENT ON COLUMN projects.memory_type IS 'Type of conversation memory: none, window, summary, or vector';
COMMENT ON COLUMN projects.query_optimization IS 'Query optimization method: semantic, hybrid, or hyde';
COMMENT ON COLUMN projects.model_name IS 'Specific model name for the provider';
COMMENT ON COLUMN projects.mmr_diversity IS 'MMR diversity parameter (0-1) for controlling diversity vs relevance';
COMMENT ON COLUMN projects.llm_reranking_model IS 'Model used for LLM-based re-ranking';
COMMENT ON COLUMN projects.window_size IS 'Number of recent messages to keep in window memory';
COMMENT ON COLUMN projects.summary_length IS 'Maximum length of conversation summary in characters';
COMMENT ON COLUMN projects.vector_similarity_threshold IS 'Minimum similarity score for vector memory retrieval';
COMMENT ON COLUMN projects.hyde_model IS 'Model used for HyDE query generation';
COMMENT ON COLUMN projects.hybrid_weight IS 'Weight between keyword (0) and semantic (1) search';
COMMENT ON COLUMN projects.model_selection_type IS 'Type of model selection: dropdown or custom'; 