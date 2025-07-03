-- Migration: Change entity_id in vector_memory from UUID to TEXT to support phone numbers or string IDs
ALTER TABLE vector_memory
ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT;
-- Now you can use phone numbers or any string as entity_id (conversation_id) 