-- Simple Chatwoot Integration Schema
-- Only the essential changes needed for Chatwoot integration

-- ============================================================================
-- 1. CREATE CHATS TABLE (Essential for chat session management)
-- ============================================================================

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  inbox_id integer NOT NULL,
  chat_id text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'human_takeover', 'resolved', 'closed')),
  human_agent_id uuid,
  takeover_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_project_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT chats_unique_conversation UNIQUE (project_id, inbox_id, chat_id)
);

-- ============================================================================
-- 2. UPDATE CONVERSATIONS TABLE (Only essential columns)
-- ============================================================================

-- Add chat_session_id to link conversations to chat sessions
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS chat_session_id uuid;

-- Add confidence score for LLM responses
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 1.0;

-- Add foreign key constraint
ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_chat_session 
FOREIGN KEY (chat_session_id) REFERENCES public.chats(id);

-- ============================================================================
-- 3. CREATE ESSENTIAL INDEXES
-- ============================================================================

CREATE INDEX idx_chats_project_inbox ON public.chats(project_id, inbox_id);
CREATE INDEX idx_chats_status ON public.chats(status);
CREATE INDEX idx_conversations_chat_session ON public.conversations(chat_session_id);

-- ============================================================================
-- 4. ONE ESSENTIAL FUNCTION
-- ============================================================================

-- Get or create chat session
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