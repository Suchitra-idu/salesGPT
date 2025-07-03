-- Add ai_config JSONB column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}';

-- Add config JSONB column to documents table (if you want per-document config)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Remove unnecessary columns from projects table, but keep inbox_id and status
ALTER TABLE projects
DROP COLUMN IF EXISTS addons,
DROP COLUMN IF EXISTS llm_model,
DROP COLUMN IF EXISTS temperature,
DROP COLUMN IF EXISTS max_history_msgs,
DROP COLUMN IF EXISTS system_prompt,
DROP COLUMN IF EXISTS match_threshold;

-- Table for summarization memory
CREATE TABLE IF NOT EXISTS summarization_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for vector memory
CREATE TABLE IF NOT EXISTS vector_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT, -- e.g., 'conversation', 'document', etc.
    entity_id UUID,   -- ID of the entity this vector is associated with
    embedding VECTOR, -- Use your vector extension type
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
); 