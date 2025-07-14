# Chat API with Advanced AI Configurations

This directory contains the chat API implementation with support for advanced AI configurations including memory types, reranking methods, and query optimizations.

## Files

- `+server.js` - Main API endpoint that handles authentication and delegates to serve.js
- `serve.js` - Core chat processing logic with advanced AI features
- `README.md` - This documentation file

## Features

### Memory Types

The system supports four types of conversation memory:

1. **None** - No memory, each question is processed independently
2. **Window** - Keeps the last N messages in memory (configurable window size)
3. **Summary** - Maintains a running summary of the conversation
4. **Vector** - Stores conversation embeddings for semantic retrieval

### Reranking Methods

Three reranking options for improving search result relevance:

1. **None** - No reranking, use original similarity scores
2. **MMR** - Maximal Marginal Relevance for diversity vs relevance balance
3. **LLM** - AI-powered reranking using language models

### Query Optimization

Three query optimization strategies:

1. **Semantic** - Use the original question as-is
2. **HyDE** - Hypothetical Document Embeddings for better retrieval
3. **Hybrid** - Combine semantic and keyword search (placeholder)

### Cost Optimization

**Conversation Management**: The system automatically manages conversation storage to reduce costs:

- **Configurable Limits**: Each project can set `max_conversation_messages` (5-100, default: 20)
- **Automatic Cleanup**: Old messages are automatically deleted when the limit is exceeded
- **Database Functions**: Efficient cleanup using PostgreSQL functions
- **Storage Optimization**: Only keeps the most recent messages for context

## Configuration

The AI configuration is stored in the `ai_config` JSONB column of the projects table:

```json
{
  "system_prompt": "You are a helpful assistant...",
  "memory_type": "window",
  "memory_config": {
    "window_size": 10
  },
  "reranking_method": "mmr",
  "reranking_config": {
    "mmr_diversity": 0.5
  },
  "query_optimization": "semantic",
  "query_optimization_config": {},
  "model_name": "gpt-3.5-turbo",
  "rag_top_k": 5,
  "temperature": 0.3,
  "similarity_threshold": 0.3,
  "max_conversation_messages": 20
}
```

## API Usage

### Request Format

```javascript
POST /api/chat
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "inbox_id": 123,
  "question": "What is the main topic?"
}
```

### Response Format

```javascript
{
  "answer": "The AI-generated response",
  "sources": ["document1.pdf", "document2.pdf"],
  "config": {
    "memory_type": "window",
    "reranking_method": "mmr",
    "query_optimization": "semantic",
    "model_name": "gpt-3.5-turbo",
    "temperature": 0.3,
    "similarity_threshold": 0.3
  }
}
```

## Backend Processing

The API automatically handles:

1. **Project Lookup** - Finds the project by `inbox_id`
2. **Conversation History** - Retrieves conversation history from the database
3. **Conversation ID Generation** - Creates conversation IDs for memory features
4. **Message Storage** - Stores both user and assistant messages in the database
5. **Automatic Cleanup** - Removes old messages to maintain cost limits

## Database Requirements

### Required Tables

1. **projects** - Contains the `ai_config` JSONB column and `inbox_id`
2. **conversations** - Chat history by inbox_id
3. **documents** - Document chunks with embeddings
4. **vector_memory** - For vector-based memory storage
5. **summarization_memory** - For conversation summaries

### Required Functions

- `match_documents()` - Vector search for document chunks
- `match_vector_memory()` - Vector search for memory entries
- `get_conversation_history()` - Get conversation history with automatic cleanup
- `cleanup_old_conversations()` - Clean up old messages for a specific inbox
- `cleanup_all_old_conversations()` - Clean up old messages across all inboxes
- `get_conversation_stats()` - Get conversation storage statistics

## Environment Variables

The following environment variables are required:

```bash
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key  # Optional
GOOGLE_API_KEY=your_google_key        # Optional
HUGGINGFACE_API_KEY=your_hf_key       # Optional
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

## Supported Models

### LLM Models
- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus, claude-3-sonnet, claude-3-haiku
- **Google**: gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro

### Embedding Models
- **OpenAI**: text-embedding-3-small, text-embedding-3-large
- **Hugging Face**: Any model from Hugging Face Hub

## Error Handling

The system includes comprehensive error handling:

- Invalid project configurations fall back to defaults
- Failed reranking falls back to original order
- Failed query optimization uses original question
- Memory operations are optional and don't break the main flow
- Conversation storage errors don't prevent response generation
- Cleanup errors are logged but don't affect chat functionality

## Performance Considerations

- Vector memory queries are limited by similarity threshold
- LLM reranking is only applied when configured
- Memory updates are asynchronous and don't block responses
- Embedding generation is cached where possible
- Conversation history is limited to configurable message count
- Automatic cleanup prevents database bloat

## Cost Optimization

### Storage Costs
- **Configurable Limits**: Set `max_conversation_messages` per project
- **Automatic Cleanup**: Old messages are deleted automatically
- **Efficient Queries**: Database functions optimize cleanup operations
- **Statistics**: Monitor storage usage with `get_conversation_stats()`

### API Costs
- **Memory Types**: Choose appropriate memory type for your use case
- **Reranking**: Only use LLM reranking when necessary
- **Query Optimization**: Use semantic filtering for most queries
- **Model Selection**: Choose cost-effective models for your needs

## Security

- All operations require valid JWT authentication
- User access is verified through Supabase RLS
- API keys are stored in environment variables
- No sensitive data is logged
- Row-level security on conversations table 