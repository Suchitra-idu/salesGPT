-- Recreate Essential Database Functions
-- This script creates only the essential functions needed for the application

-- ============================================================================
-- 1. CONVERSATION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to clean up old conversation messages
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
    p_inbox_id INTEGER,
    max_messages INTEGER DEFAULT 20
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    messages_to_delete INTEGER;
    deleted_count INTEGER;
BEGIN
    -- Get total count of messages for this inbox
    SELECT COUNT(*) INTO total_count
    FROM conversations
    WHERE inbox_id = p_inbox_id;
    
    -- If we have more than max_messages, delete the oldest ones
    IF total_count > max_messages THEN
        messages_to_delete := total_count - max_messages;
        
        -- Delete the oldest messages
        DELETE FROM conversations
        WHERE id IN (
            SELECT id
            FROM conversations
            WHERE inbox_id = p_inbox_id
            ORDER BY created_at ASC
            LIMIT messages_to_delete
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Function to get conversation history (returns the actual database structure)
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_inbox_id INTEGER,
    max_messages INTEGER DEFAULT 20
)
RETURNS TABLE (
    content TEXT,
    answer TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clean up old messages first
    PERFORM cleanup_old_conversations(p_inbox_id, max_messages);
    
    -- Return the conversation history
    RETURN QUERY
    SELECT 
        c.content,
        c.answer,
        c.summary,
        c.created_at
    FROM conversations c
    WHERE c.inbox_id = p_inbox_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- ============================================================================
-- 2. MEMORY CLEANUP FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- 3. VECTOR MEMORY MATCHING FUNCTION
-- ============================================================================

-- Function to match vector memory entries
CREATE OR REPLACE FUNCTION match_vector_memory(
    project_id UUID,
    query_embedding VECTOR,
    match_threshold NUMERIC DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
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
    AND 1 - (vm.embedding <=> query_embedding) > match_threshold
    ORDER BY vm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- 4. STATISTICS FUNCTION
-- ============================================================================

-- Function to get conversation statistics
CREATE OR REPLACE FUNCTION get_conversation_stats()
RETURNS TABLE (
    project_id UUID,
    inbox_id INTEGER,
    message_count BIGINT,
    oldest_message TIMESTAMPTZ,
    newest_message TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as project_id,
        c.inbox_id,
        COUNT(*) as message_count,
        MIN(c.created_at) as oldest_message,
        MAX(c.created_at) as newest_message
    FROM conversations c
    JOIN projects p ON p.inbox_id = c.inbox_id
    GROUP BY p.id, c.inbox_id
    ORDER BY message_count DESC;
END;
$$;

-- ============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION cleanup_old_conversations(INTEGER, INTEGER) IS 'Cleans up old conversation messages for a specific inbox, keeping only the last N messages';
COMMENT ON FUNCTION get_conversation_history(INTEGER, INTEGER) IS 'Gets conversation history for an inbox with automatic cleanup, returns content, answer, summary, created_at';
COMMENT ON FUNCTION cleanup_old_summarization_memory(INTEGER) IS 'Cleans up old summarization memory entries older than specified days';
COMMENT ON FUNCTION cleanup_old_vector_memory(INTEGER) IS 'Cleans up old vector memory entries older than specified days';
COMMENT ON FUNCTION match_vector_memory(UUID, VECTOR, NUMERIC, INTEGER) IS 'Matches vector memory entries for a project with similarity threshold';
COMMENT ON FUNCTION get_conversation_stats() IS 'Gets statistics about conversation storage across all projects and inboxes';

-- ============================================================================
-- 6. VERIFY THE FUNCTIONS WERE CREATED
-- ============================================================================

SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'cleanup_old_conversations',
    'get_conversation_history',
    'cleanup_old_summarization_memory',
    'cleanup_old_vector_memory',
    'match_vector_memory',
    'get_conversation_stats'
)
ORDER BY p.proname, pg_get_function_arguments(p.oid);

SELECT 'Essential functions recreated successfully!' as status; 