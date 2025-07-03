# Vector Memory Management TODOs

## 1. Pruning & Cleanup
- [ ] Time-based pruning: Remove entries older than X days.
- [ ] Count-based pruning: Keep only the last N entries per conversation.
- [ ] Similarity-based pruning: Deduplicate highly similar vectors.
- [ ] Usage-based pruning: Remove vectors not accessed in a long time (if access tracking is added).

## 2. Chunking Improvements
- [ ] Implement semantic chunking (split on topic/meaning, not just length).
- [ ] Adaptive chunk size: Adjust based on message/content type.
- [ ] Merge very short messages into single chunks.

## 3. Quality Control
- [ ] Only store vectors for messages above a minimum length.
- [ ] Re-embed old content if/when the embedding model is upgraded.

## 4. Maintenance Functions
- [ ] Scheduled cleanup jobs (Supabase/PG cron or external).
- [ ] Manual maintenance endpoint or script.

## 5. Summarized Conversation Storage (New Idea)
- [ ] Instead of storing full previous chats, generate a short summary for each chat/response (using the main LLM call, not an extra one).
- [ ] Store this per-turn summary in the conversation table.
- [ ] For context (router or main LLM), use the summaries of each previous chat plus the overall summary, instead of the full chat text.
- [ ] This reduces token usage and storage, and makes context more efficient. 