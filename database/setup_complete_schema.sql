-- Complete Database Schema Setup for SalesGPT
-- Run this in your Supabase SQL Editor to set up all required database objects

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id ON conversations(inbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see conversations for projects they have access to
CREATE POLICY "Users can view conversations for their projects" ON conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles pr ON p.client_id = pr.id
            WHERE p.inbox_id = conversations.inbox_id
            AND pr.id = auth.uid()
        )
    );

-- Policy to allow users to insert conversations for their projects
CREATE POLICY "Users can insert conversations for their projects" ON conversations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles pr ON p.client_id = pr.id
            WHERE p.inbox_id = conversations.inbox_id
            AND pr.id = auth.uid()
        )
    );

-- 2. Create summarization_memory table
CREATE TABLE IF NOT EXISTS summarization_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint on project_id to ensure one summary per project
ALTER TABLE summarization_memory 
ADD CONSTRAINT IF NOT EXISTS unique_project_summary UNIQUE (project_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_summarization_memory_project_id ON summarization_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_summarization_memory_created_at ON summarization_memory(created_at);

-- 3. Create vector_memory table
CREATE TABLE IF NOT EXISTS vector_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT, -- e.g., 'conversation', 'document', etc.
    entity_id TEXT,   -- ID of the entity this vector is associated with (changed to TEXT)
    embedding VECTOR, -- Use your vector extension type
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vector_memory_project_id ON vector_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_vector_memory_created_at ON vector_memory(created_at);

-- 4. Create chat_analytics table
CREATE TABLE IF NOT EXISTS chat_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    conversation_id text,
    user_id uuid,
    timings jsonb,         -- {step_name: ms, ...}
    token_usage jsonb,     -- {prompt: n, completion: n, total: n}
    model_name text,
    provider text,
    temperature float,
    created_at timestamptz DEFAULT now(),
    error text
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_project_id ON chat_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_conversation_id ON chat_analytics(conversation_id);

-- 5. Add ai_config column to projects table if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}';

-- 6. Create conversation cleanup functions
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

-- 7. Create vector memory functions
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

-- 8. Add comments for documentation
COMMENT ON TABLE conversations IS 'Stores chat conversation history by inbox_id';
COMMENT ON COLUMN conversations.inbox_id IS 'References the inbox_id from projects table';
COMMENT ON COLUMN conversations.role IS 'Role of the message sender: user or assistant';
COMMENT ON COLUMN conversations.content IS 'The message content';
COMMENT ON COLUMN conversations.summary IS 'Summary of this conversation turn (Q&A pair)';
COMMENT ON COLUMN conversations.created_at IS 'Timestamp when the message was created';

COMMENT ON FUNCTION cleanup_old_conversations IS 'Cleans up old conversation messages for a specific inbox, keeping only the last N messages';
COMMENT ON FUNCTION get_conversation_history IS 'Gets conversation history for an inbox with automatic cleanup of old messages, including summary field';
COMMENT ON FUNCTION cleanup_all_old_conversations IS 'Cleans up old conversations across all inboxes';
COMMENT ON FUNCTION get_conversation_stats IS 'Gets statistics about conversation storage across all inboxes';

-- 9. Verify the setup
SELECT 'Database schema setup completed successfully!' as status; 