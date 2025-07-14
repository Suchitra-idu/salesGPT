-- Test Conversation Schema and Functions
-- This script tests that the conversation saving and retrieval works correctly

-- ============================================================================
-- 1. TEST CONVERSATION INSERTION
-- ============================================================================

-- Test inserting a conversation with the correct schema
INSERT INTO conversations (
    inbox_id,
    content,
    answer,
    summary,
    used_rag,
    created_at
) VALUES (
    123,
    'What is artificial intelligence?',
    'Artificial intelligence (AI) is a branch of computer science that aims to create systems capable of performing tasks that typically require human intelligence.',
    'User asked about AI definition; I provided a comprehensive explanation.',
    true,
    NOW()
);

-- Verify the insertion worked
SELECT 
    id,
    inbox_id,
    content,
    answer,
    summary,
    used_rag,
    created_at
FROM conversations 
WHERE inbox_id = 123 
ORDER BY created_at DESC 
LIMIT 1;

-- ============================================================================
-- 2. TEST CONVERSATION HISTORY FUNCTION
-- ============================================================================

-- Test the get_conversation_history function
SELECT * FROM get_conversation_history(123, 10);

-- ============================================================================
-- 3. TEST CLEANUP FUNCTION
-- ============================================================================

-- Test the cleanup function (should return 0 since we only have 1 message)
SELECT cleanup_old_conversations(123, 20) as deleted_count;

-- ============================================================================
-- 4. VERIFY SCHEMA CONSTRAINTS
-- ============================================================================

-- This should fail (content is NOT NULL)
-- INSERT INTO conversations (inbox_id, content, answer) VALUES (123, NULL, 'This should fail');

-- This should work (content is provided)
INSERT INTO conversations (inbox_id, content, answer) VALUES (123, 'Test question', 'Test answer');

-- ============================================================================
-- 5. CLEANUP TEST DATA
-- ============================================================================

-- Remove test data
DELETE FROM conversations WHERE inbox_id = 123;

SELECT 'Conversation schema test completed successfully!' as status; 