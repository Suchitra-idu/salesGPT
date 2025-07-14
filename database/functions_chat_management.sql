-- Chat Management Functions
-- Functions for managing chat sessions and human takeover capabilities

-- ============================================================================
-- 1. CHAT SESSION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get or create a chat session
CREATE OR REPLACE FUNCTION get_or_create_chat(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_chat_id UUID;
BEGIN
    -- Try to find existing chat session
    SELECT id INTO v_chat_id
    FROM chats
    WHERE project_id = p_project_id
    AND inbox_id = p_inbox_id
    AND chat_id = p_chat_id;
    
    -- If not found, create new chat session
    IF v_chat_id IS NULL THEN
        INSERT INTO chats (project_id, inbox_id, chat_id)
        VALUES (p_project_id, p_inbox_id, p_chat_id)
        RETURNING id INTO v_chat_id;
    END IF;
    
    RETURN v_chat_id;
END;
$$;

-- Function to update chat status
CREATE OR REPLACE FUNCTION update_chat_status(
    p_chat_session_id UUID,
    p_status TEXT,
    p_human_agent_id UUID DEFAULT NULL,
    p_takeover_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE chats
    SET 
        status = p_status,
        human_agent_id = COALESCE(p_human_agent_id, human_agent_id),
        takeover_reason = COALESCE(p_takeover_reason, takeover_reason),
        takeover_timestamp = CASE 
            WHEN p_status = 'human_takeover' AND takeover_timestamp IS NULL 
            THEN now() 
            ELSE takeover_timestamp 
        END,
        updated_at = now()
    WHERE id = p_chat_session_id;
    
    RETURN FOUND;
END;
$$;

-- Function to get chat session details
CREATE OR REPLACE FUNCTION get_chat_session(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT
)
RETURNS TABLE (
    id UUID,
    status TEXT,
    human_agent_id UUID,
    takeover_reason TEXT,
    takeover_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.status,
        c.human_agent_id,
        c.takeover_reason,
        c.takeover_timestamp,
        c.created_at,
        c.updated_at,
        c.metadata
    FROM chats c
    WHERE c.project_id = p_project_id
    AND c.inbox_id = p_inbox_id
    AND c.chat_id = p_chat_id;
END;
$$;

-- ============================================================================
-- 2. ENHANCED CONVERSATION FUNCTIONS
-- ============================================================================

-- Function to get conversation history with chat session support
CREATE OR REPLACE FUNCTION get_conversation_history_with_chat(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT,
    max_messages INTEGER DEFAULT 20
)
RETURNS TABLE (
    content TEXT,
    answer TEXT,
    summary TEXT,
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_chat_session_id UUID;
BEGIN
    -- Get or create chat session
    SELECT get_or_create_chat(p_project_id, p_inbox_id, p_chat_id) INTO v_chat_session_id;
    
    -- Return the conversation history
    RETURN QUERY
    SELECT 
        c.content,
        c.answer,
        c.summary,
        c.confidence_score,
        c.created_at
    FROM conversations c
    WHERE c.project_id = p_project_id
    AND c.inbox_id = p_inbox_id
    AND c.chat_id = p_chat_id
    AND c.chat_session_id = v_chat_session_id
    ORDER BY c.created_at ASC
    LIMIT max_messages;
END;
$$;

-- Function to save conversation with chat session
CREATE OR REPLACE FUNCTION save_conversation_with_chat(
    p_project_id UUID,
    p_inbox_id INTEGER,
    p_chat_id TEXT,
    p_content TEXT,
    p_answer TEXT,
    p_summary TEXT DEFAULT NULL,
    p_confidence_score NUMERIC DEFAULT 1.0,
    p_used_rag BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_chat_session_id UUID;
    v_conversation_id UUID;
BEGIN
    -- Get or create chat session
    SELECT get_or_create_chat(p_project_id, p_inbox_id, p_chat_id) INTO v_chat_session_id;
    
    -- Insert conversation
    INSERT INTO conversations (
        project_id,
        inbox_id,
        chat_id,
        chat_session_id,
        content,
        answer,
        summary,
        confidence_score,
        used_rag,
        created_at
    ) VALUES (
        p_project_id,
        p_inbox_id,
        p_chat_id,
        v_chat_session_id,
        p_content,
        p_answer,
        p_summary,
        p_confidence_score,
        p_used_rag,
        now()
    ) RETURNING id INTO v_conversation_id;
    
    RETURN v_conversation_id;
END;
$$;

-- ============================================================================
-- 3. CHAT ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get chat statistics
CREATE OR REPLACE FUNCTION get_chat_statistics(
    p_project_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_chats INTEGER,
    active_chats INTEGER,
    human_takeover_chats INTEGER,
    resolved_chats INTEGER,
    avg_confidence_score NUMERIC,
    handoff_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT c.id)::INTEGER as total_chats,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END)::INTEGER as active_chats,
        COUNT(DISTINCT CASE WHEN c.status = 'human_takeover' THEN c.id END)::INTEGER as human_takeover_chats,
        COUNT(DISTINCT CASE WHEN c.status = 'resolved' THEN c.id END)::INTEGER as resolved_chats,
        AVG(conv.confidence_score) as avg_confidence_score,
        CASE 
            WHEN COUNT(DISTINCT c.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN c.status = 'human_takeover' THEN c.id END)::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100
            ELSE 0 
        END as handoff_rate
    FROM chats c
    LEFT JOIN conversations conv ON c.id = conv.chat_session_id
    WHERE c.project_id = p_project_id
    AND c.created_at >= now() - INTERVAL '1 day' * p_days_back;
END;
$$;

-- ============================================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_or_create_chat(UUID, INTEGER, TEXT) IS 'Gets existing chat session or creates new one for project/inbox/chat combination';
COMMENT ON FUNCTION update_chat_status(UUID, TEXT, UUID, TEXT) IS 'Updates chat status and handles human takeover information';
COMMENT ON FUNCTION get_chat_session(UUID, INTEGER, TEXT) IS 'Gets chat session details for project/inbox/chat combination';
COMMENT ON FUNCTION get_conversation_history_with_chat(UUID, INTEGER, TEXT, INTEGER) IS 'Gets conversation history with chat session support';
COMMENT ON FUNCTION save_conversation_with_chat(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) IS 'Saves conversation with chat session linking';
COMMENT ON FUNCTION get_chat_statistics(UUID, INTEGER) IS 'Gets chat analytics and statistics for a project'; 