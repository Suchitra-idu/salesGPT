-- Statistics and Analytics Functions
-- Functions for getting conversation and system statistics

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

-- Add comments for documentation
COMMENT ON FUNCTION get_conversation_stats() IS 'Gets statistics about conversation storage across all projects and inboxes'; 