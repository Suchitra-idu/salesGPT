-- Comprehensive cleanup and update for get_conversation_history function
-- Run this in your Supabase SQL Editor

-- First, let's see what functions exist with this name
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_conversation_history';

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS get_conversation_history(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_conversation_history(INTEGER);
DROP FUNCTION IF EXISTS get_conversation_history();

-- Now create the new function with summary field
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

-- Verify the function was created correctly
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_conversation_history'; 