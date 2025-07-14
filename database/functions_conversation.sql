-- Conversation Management Functions
-- Based on actual schema: conversations table has content, answer, summary, inbox_id, chat_id fields

-- Function to clean up old conversation messages
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
    p_inbox_id INTEGER,
    p_chat_id TEXT,
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
    -- Get total count of messages for this inbox and chat
    SELECT COUNT(*) INTO total_count
    FROM conversations
    WHERE inbox_id = p_inbox_id
    AND chat_id = p_chat_id;
    
    -- If we have more than max_messages, delete the oldest ones
    IF total_count > max_messages THEN
        messages_to_delete := total_count - max_messages;
        
        -- Delete the oldest messages
        DELETE FROM conversations
        WHERE id IN (
            SELECT id
            FROM conversations
            WHERE inbox_id = p_inbox_id
            AND chat_id = p_chat_id
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
    p_chat_id TEXT,
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
    PERFORM cleanup_old_conversations(p_inbox_id, p_chat_id, max_messages);
    
    -- Return the conversation history
    RETURN QUERY
    SELECT 
        c.content,
        c.answer,
        c.summary,
        c.created_at
    FROM conversations c
    WHERE c.inbox_id = p_inbox_id
    AND c.chat_id = p_chat_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- Function to get conversation history with project_id and chat_id
CREATE OR REPLACE FUNCTION get_conversation_history_by_project(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT,
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
    PERFORM cleanup_old_conversations(p_inbox_id, p_chat_id, max_messages);
    
    -- Return the conversation history
    RETURN QUERY
    SELECT 
        c.content,
        c.answer,
        c.summary,
        c.created_at
    FROM conversations c
    WHERE c.project_id = p_project_id
    AND c.inbox_id = p_inbox_id
    AND c.chat_id = p_chat_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_old_conversations(INTEGER, TEXT, INTEGER) IS 'Cleans up old conversation messages for a specific inbox and chat';
COMMENT ON FUNCTION get_conversation_history(INTEGER, TEXT, INTEGER) IS 'Gets conversation history for a specific inbox and chat';
COMMENT ON FUNCTION get_conversation_history_by_project(UUID, INTEGER, TEXT, INTEGER) IS 'Gets conversation history for a specific project, inbox, and chat combination'; 