-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.chat_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  conversation_id text,
  user_id uuid,
  step_times jsonb,
  token_usage jsonb,
  model_name text,
  provider text,
  temperature double precision,
  created_at timestamp with time zone DEFAULT now(),
  error text,
  timings jsonb,
  CONSTRAINT chat_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT chat_analytics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  business_type text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  location_country text,
  location_city text,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  inbox_id integer NOT NULL,
  chat_id text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'human_takeover', 'resolved', 'closed')),
  human_agent_id uuid,
  takeover_reason text,
  takeover_timestamp timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_project_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT chats_unique_conversation UNIQUE (project_id, inbox_id, chat_id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  project_id uuid,
  answer text,
  inbox_id integer,
  chat_id text,
  chat_session_id uuid,
  summary text,
  confidence_score numeric DEFAULT 1.0,
  used_rag boolean DEFAULT false,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT fk_conversations_project FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT fk_conversations_chat_session FOREIGN KEY (chat_session_id) REFERENCES public.chats(id)
);
CREATE TABLE public.documents (
  id bigint NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  project_id uuid NOT NULL,
  doc_name text,
  chunk_index integer,
  content text,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  config jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  is_dev boolean DEFAULT false,
  email text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  inbox_id integer UNIQUE,
  ai_config jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.summarization_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  summary text,
  created_at timestamp with time zone DEFAULT now(),
  inbox_id integer,
  chat_id text,
  CONSTRAINT summarization_memory_pkey PRIMARY KEY (id),
  CONSTRAINT summarization_memory_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.vector_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  entity_type text,
  entity_id text,
  embedding USER-DEFINED,
  content text,
  created_at timestamp with time zone DEFAULT now(),
  inbox_id integer,
  chat_id text,
  CONSTRAINT vector_memory_pkey PRIMARY KEY (id),
  CONSTRAINT vector_memory_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);