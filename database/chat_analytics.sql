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