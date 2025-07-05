-- Reset and recreate all conversation/memory functions for the current schema
-- Run this in your Supabase SQL Editor

-- 1. Drop all old functions (if they exist)
DROP FUNCTION IF EXISTS get_conversation_history(uuid, text, integer);
DROP FUNCTION IF EXISTS cleanup_old_conversations(uuid, text, integer);
DROP FUNCTION IF EXISTS cleanup_all_old_conversations(integer);
DROP FUNCTION IF EXISTS get_conversation_stats();
DROP FUNCTION IF EXISTS get_summary_memory(uuid, text);
DROP FUNCTION IF EXISTS cleanup_old_summarization_memory(uuid, text, integer);
DROP FUNCTION IF EXISTS get_vector_memory(uuid, text, integer, float);
DROP FUNCTION IF EXISTS cleanup_old_vector_memory(uuid, text, integer);

-- 2. Conversation history retrieval
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_project_id UUID,
    p_conversation_id TEXT,
    max_messages INTEGER DEFAULT 20
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    answer TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ,
    used_rag BOOL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN c.answer IS NULL THEN 'user' ELSE 'assistant' END AS role,
        c.content,
        c.answer,
        c.summary,
        c.created_at,
        c.used_rag
    FROM conversations c
    WHERE c.project_id = p_project_id
      AND c.conversation_id = p_conversation_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- 3. Conversation cleanup
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
    p_project_id UUID,
    p_conversation_id TEXT,
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
    SELECT COUNT(*) INTO total_count
    FROM conversations
    WHERE project_id = p_project_id
      AND conversation_id = p_conversation_id;

    IF total_count > max_messages THEN
        messages_to_delete := total_count - max_messages;
        DELETE FROM conversations
        WHERE id IN (
            SELECT id
            FROM conversations
            WHERE project_id = p_project_id
              AND conversation_id = p_conversation_id
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

-- 4. Summarization memory retrieval
CREATE OR REPLACE FUNCTION get_summary_memory(
    p_project_id UUID,
    p_conversation_id TEXT
)
RETURNS TABLE (
    summary TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT summary, created_at
    FROM summarization_memory
    WHERE project_id = p_project_id
      AND conversation_id = p_conversation_id
    ORDER BY created_at DESC
    LIMIT 1;
END;
$$;

-- 5. Summarization memory cleanup
CREATE OR REPLACE FUNCTION cleanup_old_summarization_memory(
    p_project_id UUID,
    p_conversation_id TEXT,
    max_entries INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    entries_to_delete INTEGER;
    deleted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM summarization_memory
    WHERE project_id = p_project_id
      AND conversation_id = p_conversation_id;

    IF total_count > max_entries THEN
        entries_to_delete := total_count - max_entries;
        DELETE FROM summarization_memory
        WHERE id IN (
            SELECT id
            FROM summarization_memory
            WHERE project_id = p_project_id
              AND conversation_id = p_conversation_id
            ORDER BY created_at ASC
            LIMIT entries_to_delete
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- 6. Vector memory retrieval
CREATE OR REPLACE FUNCTION get_vector_memory(
    p_project_id UUID,
    p_conversation_id TEXT,
    top_k INTEGER DEFAULT 5,
    min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT id, content, 1 - (embedding <=> embedding) as similarity, created_at
    FROM vector_memory
    WHERE project_id = p_project_id
      AND conversation_id = p_conversation_id
      AND 1 - (embedding <=> embedding) >= min_similarity
    ORDER BY similarity DESC, created_at DESC
    LIMIT top_k;
END;
$$;

-- 7. Vector memory cleanup
CREATE OR REPLACE FUNCTION cleanup_old_vector_memory(
    p_project_id UUID,
    p_conversation_id TEXT,
    max_entries INTEGER DEFAULT 20
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    entries_to_delete INTEGER;
    deleted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM vector_memory
    WHERE project_id = p_project_id
      AND conversation_id = p_conversation_id;

    IF total_count > max_entries THEN
        entries_to_delete := total_count - max_entries;
        DELETE FROM vector_memory
        WHERE id IN (
            SELECT id
            FROM vector_memory
            WHERE project_id = p_project_id
              AND conversation_id = p_conversation_id
            ORDER BY created_at ASC
            LIMIT entries_to_delete
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- 8. (Optional) Conversation stats
CREATE OR REPLACE FUNCTION get_conversation_stats()
RETURNS TABLE (
    project_id UUID,
    conversation_id TEXT,
    message_count BIGINT,
    oldest_message TIMESTAMPTZ,
    newest_message TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        project_id,
        conversation_id,
        COUNT(*) as message_count,
        MIN(created_at) as oldest_message,
        MAX(created_at) as newest_message
    FROM conversations
    GROUP BY project_id, conversation_id
    ORDER BY message_count DESC;
END;
$$;

-- Show success message
SELECT 'All conversation and memory functions have been reset and recreated for the current schema!' as status; 