-- Migration to remove entity_type and entity_id from summarization_memory table
-- This migration should be run after updating the table definition

-- Drop the unique constraint if it exists
ALTER TABLE summarization_memory 
DROP CONSTRAINT IF EXISTS unique_project_entity;

-- Drop the columns
ALTER TABLE summarization_memory 
DROP COLUMN IF EXISTS entity_type,
DROP COLUMN IF EXISTS entity_id;

-- Add a unique constraint on project_id to ensure one summary per project
ALTER TABLE summarization_memory 
ADD CONSTRAINT unique_project_summary UNIQUE (project_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_summarization_memory_project_id ON summarization_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_summarization_memory_created_at ON summarization_memory(created_at); 