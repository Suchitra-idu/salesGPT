-- Create conversations table to store chat history
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

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Stores chat conversation history by inbox_id';
COMMENT ON COLUMN conversations.inbox_id IS 'References the inbox_id from projects table';
COMMENT ON COLUMN conversations.role IS 'Role of the message sender: user or assistant';
COMMENT ON COLUMN conversations.content IS 'The message content';
COMMENT ON COLUMN conversations.summary IS 'Summary of this conversation turn (Q&A pair)';
COMMENT ON COLUMN conversations.created_at IS 'Timestamp when the message was created'; 