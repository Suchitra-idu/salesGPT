# Database Migrations

This directory contains SQL migration files for the SalesGPT database schema.

## Migration Files

### 1. `rls_profiles.sql`
Enables Row Level Security (RLS) on the profiles table and creates policies for user access control.

### 2. `add_advanced_options_fields.sql`
Adds advanced AI/retrieval options fields to the projects table, including:
- Re-ranking methods (none, mmr, llm)
- Memory types (none, window, summary, vector)
- Query optimization methods (semantic, hybrid, hyde)
- Model providers (openai, anthropic, perplexity, google)
- Dynamic parameters for each option

## Running Migrations

### Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of each migration file
4. Execute the SQL commands

### Using Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Manual Execution
1. Connect to your Supabase database
2. Execute the SQL commands in order:
   - `rls_profiles.sql`
   - `add_advanced_options_fields.sql`

## New Fields Added

### Advanced Options Fields
- `reranking_method`: Method for re-ranking search results
- `memory_type`: Type of conversation memory
- `query_optimization`: Query optimization method
- `model_provider`: LLM provider
- `model_name`: Specific model name

### Dynamic Parameters
- `mmr_diversity`: MMR diversity parameter (0-1)
- `llm_reranking_model`: Model for LLM-based re-ranking
- `window_size`: Number of messages in window memory
- `summary_length`: Maximum summary length in characters
- `vector_similarity_threshold`: Similarity threshold for vector memory
- `hyde_model`: Model for HyDE query generation
- `hybrid_weight`: Weight between keyword and semantic search

## Constraints
The migration includes constraints to ensure data integrity:
- Valid values for dropdown fields
- Numeric ranges for parameters
- Required field validations

## Rollback
To rollback the advanced options migration:
```sql
-- Remove constraints
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_reranking_method;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_memory_type;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_query_optimization;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_model_provider;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_mmr_diversity;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_window_size;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_summary_length;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_vector_similarity_threshold;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_hybrid_weight;

-- Remove columns
ALTER TABLE projects DROP COLUMN IF EXISTS reranking_method;
ALTER TABLE projects DROP COLUMN IF EXISTS memory_type;
ALTER TABLE projects DROP COLUMN IF EXISTS query_optimization;
ALTER TABLE projects DROP COLUMN IF EXISTS model_provider;
ALTER TABLE projects DROP COLUMN IF EXISTS model_name;
ALTER TABLE projects DROP COLUMN IF EXISTS mmr_diversity;
ALTER TABLE projects DROP COLUMN IF EXISTS llm_reranking_model;
ALTER TABLE projects DROP COLUMN IF EXISTS window_size;
ALTER TABLE projects DROP COLUMN IF EXISTS summary_length;
ALTER TABLE projects DROP COLUMN IF EXISTS vector_similarity_threshold;
ALTER TABLE projects DROP COLUMN IF EXISTS hyde_model;
ALTER TABLE projects DROP COLUMN IF EXISTS hybrid_weight;
``` 