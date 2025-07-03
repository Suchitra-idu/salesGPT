-- Function to match vector memory entries
CREATE OR REPLACE FUNCTION match_vector_memory(
    project_id UUID,
    query_embedding VECTOR,
    match_threshold DECIMAL DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vm.id,
        vm.content,
        1 - (vm.embedding <=> query_embedding) as similarity
    FROM vector_memory vm
    WHERE vm.project_id = match_vector_memory.project_id
    AND 1 - (vm.embedding <=> query_embedding) > match_threshold
    ORDER BY vm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to clean up old vector memory entries (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_vector_memory(
    days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vector_memory 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Function to clean up old summarization memory entries (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_summarization_memory(
    days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM summarization_memory 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vector_memory_project_id ON vector_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_vector_memory_created_at ON vector_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_summarization_memory_project_id ON summarization_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_summarization_memory_created_at ON summarization_memory(created_at); 