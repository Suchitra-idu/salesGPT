-- Memory Management Functions
-- Functions for cleaning up and matching memory entries based on actual schema

-- Function to clean up old summarization memory entries
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

-- Function to clean up old vector memory entries
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

-- Function to match vector memory entries with chat_id support
CREATE OR REPLACE FUNCTION match_vector_memory(
    project_id UUID,
    query_embedding VECTOR,
    match_threshold NUMERIC DEFAULT 0.7,
    match_count INTEGER DEFAULT 5,
    inbox_id INTEGER DEFAULT NULL,
    chat_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity NUMERIC
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
    AND (inbox_id IS NULL OR vm.inbox_id = match_vector_memory.inbox_id)
    AND (chat_id IS NULL OR vm.chat_id = match_vector_memory.chat_id)
    AND 1 - (vm.embedding <=> query_embedding) > match_threshold
    ORDER BY vm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get summarization memory for a specific chat
CREATE OR REPLACE FUNCTION get_summarization_memory(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    summary TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.summary,
        sm.created_at
    FROM summarization_memory sm
    WHERE sm.project_id = p_project_id
    AND sm.inbox_id = p_inbox_id
    AND sm.chat_id = p_chat_id
    ORDER BY sm.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_old_summarization_memory(INTEGER) IS 'Cleans up old summarization memory entries older than specified days';
COMMENT ON FUNCTION cleanup_old_vector_memory(INTEGER) IS 'Cleans up old vector memory entries older than specified days';
COMMENT ON FUNCTION match_vector_memory(UUID, VECTOR, NUMERIC, INTEGER, INTEGER, TEXT) IS 'Matches vector memory entries for a project with chat_id support and similarity threshold';
COMMENT ON FUNCTION get_summarization_memory(UUID, INTEGER, TEXT, INTEGER) IS 'Gets summarization memory for a specific project, inbox, and chat combination'; 