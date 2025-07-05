-- Clean up all existing functions related to conversations and memory
-- Run this in your Supabase SQL Editor to remove all functions before recreating them

-- First, let's see what functions exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'get_conversation_history',
    'cleanup_old_conversations', 
    'cleanup_all_old_conversations',
    'get_conversation_stats',
    'match_vector_memory',
    'cleanup_old_vector_memory',
    'cleanup_old_summarization_memory'
)
ORDER BY p.proname, pg_get_function_arguments(p.oid);

-- Drop all versions of conversation-related functions
DROP FUNCTION IF EXISTS get_conversation_history(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_conversation_history(INTEGER);
DROP FUNCTION IF EXISTS get_conversation_history();

DROP FUNCTION IF EXISTS cleanup_old_conversations(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_conversations(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_conversations();

DROP FUNCTION IF EXISTS cleanup_all_old_conversations(INTEGER);
DROP FUNCTION IF EXISTS cleanup_all_old_conversations();

DROP FUNCTION IF EXISTS get_conversation_stats();

-- Drop all versions of vector memory functions
DROP FUNCTION IF EXISTS match_vector_memory(UUID, VECTOR, DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS match_vector_memory(UUID, VECTOR, DECIMAL);
DROP FUNCTION IF EXISTS match_vector_memory(UUID, VECTOR);
DROP FUNCTION IF EXISTS match_vector_memory();

DROP FUNCTION IF EXISTS cleanup_old_vector_memory(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_vector_memory();

DROP FUNCTION IF EXISTS cleanup_old_summarization_memory(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_summarization_memory();

-- Verify all functions are dropped
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'get_conversation_history',
    'cleanup_old_conversations', 
    'cleanup_all_old_conversations',
    'get_conversation_stats',
    'match_vector_memory',
    'cleanup_old_vector_memory',
    'cleanup_old_summarization_memory'
)
ORDER BY p.proname, pg_get_function_arguments(p.oid);

-- Show result
SELECT 'All conversation and memory functions have been dropped!' as status; 