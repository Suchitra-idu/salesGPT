-- Cleanup Redundant Database Functions
-- This script removes all redundant functions and keeps only the essential ones

-- ============================================================================
-- CLEANUP: Remove all redundant functions
-- ============================================================================

-- 1. Drop all versions of cleanup_old_conversations (keep only the inbox_id version)
DROP FUNCTION IF EXISTS cleanup_old_conversations(p_project_id uuid, p_conversation_id text, max_messages integer);
DROP FUNCTION IF EXISTS cleanup_old_conversations(p_project_id uuid, max_messages integer);
DROP FUNCTION IF EXISTS cleanup_old_conversations(p_project_id uuid, p_inbox_id integer, max_messages integer);
DROP FUNCTION IF EXISTS cleanup_old_conversations_by_conversation(p_project_id uuid, p_conversation_id uuid, max_messages integer);

-- 2. Drop all versions of get_conversation_history (keep only the inbox_id version)
DROP FUNCTION IF EXISTS get_conversation_history(p_project_id uuid, p_conversation_id text, max_messages integer);
DROP FUNCTION IF EXISTS get_conversation_history(p_project_id uuid, max_messages integer);
DROP FUNCTION IF EXISTS get_conversation_history(p_project_id uuid, p_inbox_id integer, max_messages integer);

-- 3. Drop all versions of cleanup_old_summarization_memory (keep only the days_to_keep version)
DROP FUNCTION IF EXISTS cleanup_old_summarization_memory(p_project_id uuid, p_conversation_id text, max_entries integer);
DROP FUNCTION IF EXISTS cleanup_old_summarization_memory(p_project_id uuid, p_inbox_id integer, max_entries integer);

-- 4. Drop all versions of cleanup_old_vector_memory (keep only the days_to_keep version)
DROP FUNCTION IF EXISTS cleanup_old_vector_memory(p_project_id uuid, p_conversation_id text, max_entries integer);
DROP FUNCTION IF EXISTS cleanup_old_vector_memory(p_project_id uuid, p_inbox_id integer, max_entries integer);

-- 5. Drop all versions of get_summary_memory (not needed since we query directly)
DROP FUNCTION IF EXISTS get_summary_memory(p_project_id uuid, p_conversation_id text);
DROP FUNCTION IF EXISTS get_summary_memory(p_project_id uuid, p_inbox_id integer);

-- 6. Drop all versions of get_vector_memory (not needed since we use match_vector_memory)
DROP FUNCTION IF EXISTS get_vector_memory(p_project_id uuid, p_conversation_id text, top_k integer, min_similarity double precision);
DROP FUNCTION IF EXISTS get_vector_memory(p_project_id uuid, p_inbox_id integer, top_k integer, min_similarity double precision);

-- 7. Drop redundant match_vector_memory versions (keep only the project_id version)
DROP FUNCTION IF EXISTS match_vector_memory(project_id uuid, conversation_id uuid, query_embedding vector, match_threshold numeric, match_count integer);
DROP FUNCTION IF EXISTS match_vector_memory(project_id uuid, conversation_id text, query_embedding vector, match_threshold numeric, match_count integer);

SELECT 'Redundant functions cleanup completed!' as status; 