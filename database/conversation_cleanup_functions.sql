-- Function to clean up old conversation messages, keeping only the last N messages per inbox
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

-- Function to get conversation history with automatic cleanup
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_inbox_id INTEGER,
    max_messages INTEGER DEFAULT 20
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
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
        c.role,
        c.content,
        c.summary,
        c.created_at
    FROM conversations c
    WHERE c.inbox_id = p_inbox_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- Function to clean up all old conversations across all inboxes
CREATE OR REPLACE FUNCTION cleanup_all_old_conversations(
    max_messages INTEGER DEFAULT 20
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inbox_record RECORD;
    total_deleted INTEGER := 0;
    deleted_count INTEGER;
BEGIN
    -- Loop through all unique inbox_ids
    FOR inbox_record IN 
        SELECT DISTINCT inbox_id 
        FROM conversations 
        WHERE inbox_id IS NOT NULL
    LOOP
        deleted_count := cleanup_old_conversations(inbox_record.inbox_id, max_messages);
        total_deleted := total_deleted + deleted_count;
    END LOOP;
    
    RETURN total_deleted;
END;
$$;

-- Function to get conversation statistics
CREATE OR REPLACE FUNCTION get_conversation_stats()
RETURNS TABLE (
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
        c.inbox_id,
        COUNT(*) as message_count,
        MIN(c.created_at) as oldest_message,
        MAX(c.created_at) as newest_message
    FROM conversations c
    GROUP BY c.inbox_id
    ORDER BY message_count DESC;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_old_conversations IS 'Cleans up old conversation messages for a specific inbox, keeping only the last N messages';
COMMENT ON FUNCTION get_conversation_history IS 'Gets conversation history for an inbox with automatic cleanup of old messages';
COMMENT ON FUNCTION cleanup_all_old_conversations IS 'Cleans up old conversations across all inboxes';
COMMENT ON FUNCTION get_conversation_stats IS 'Gets statistics about conversation storage across all inboxes'; 