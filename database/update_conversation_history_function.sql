-- Update the get_conversation_history function to include summary field
-- Run this in your Supabase SQL Editor

-- First, drop the existing function to avoid conflicts
DROP FUNCTION IF EXISTS get_conversation_history(INTEGER, INTEGER);

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

-- Add comment for documentation
COMMENT ON FUNCTION get_conversation_history(INTEGER, INTEGER) IS 'Gets conversation history for an inbox with automatic cleanup of old messages, including summary field'; 