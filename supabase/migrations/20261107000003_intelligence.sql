-- =============================================================================
-- Migration 003: Organizational intelligence — memory (pgvector), files,
-- reports, Studio, approvals, notifications, usage, credentials, audit
-- =============================================================================

create table public.memory_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null, content text not null,
  category text not null,
  importance int not null default 3 check (importance between 1 and 5),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','VERIFIED','USER_CONFIRMED','SYSTEM_IMPORTED','ARCHIVED')),
  pinned boolean not null default false,
  source_type text not null,
  source_id uuid,
  created_by uuid not null references public.profiles (id),
  verified_by uuid references public.profiles (id),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  embedding vector(256),                  -- lexical v1 embedding written by the application
  semantic_embedding vector(1536),        -- provider embedding written by the embedding worker (Phase 7)
  visibility text not null default 'ORGANIZATION' check (visibility in ('ORGANIZATION','LEADERSHIP','OWNER_ONLY')),
  executive_relevance text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))) stored
);
create index memory_org_updated_idx on public.memory_records (organization_id, updated_at desc);
create index memory_search_idx on public.memory_records using gin (search_document);
create index memory_semantic_idx on public.memory_records using hnsw (semantic_embedding vector_cosine_ops);

-- Candidate pre-filter for retrieval. Visibility and status are enforced here AND by RLS.
create or replace function public.match_memory_records(p_org uuid, p_query vector(1536), p_limit int default 40)
returns setof public.memory_records language sql stable security invoker set search_path = public as $$
  select * from memory_records
  where organization_id = p_org and status <> 'ARCHIVED' and semantic_embedding is not null
  order by semantic_embedding <=> p_query
  limit least(p_limit, 100);
$$;

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id),
  filename text not null, mime_type text not null, size bigint not null check (size > 0 and size <= 20971520),
  storage_path text not null unique,
  category text not null default 'Document',
  processing_status text not null default 'PENDING' check (processing_status in ('PENDING','PROCESSING','READY','FAILED')),
  extracted_text text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  report_type text not null, title text not null, summary text not null default '', content text not null,
  lead_executive_id uuid not null references public.ai_executives (id),
  contributing_executive_ids uuid[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,
  version int not null default 1,
  source_session_id uuid references public.executive_sessions (id) on delete set null,
  simulated boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,''))) stored
);
create index reports_search_idx on public.reports using gin (search_document);

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  requested_by uuid not null references public.profiles (id),
  request text not null, title text not null, artifact_type text not null, capability_key text not null,
  lead_executive_id uuid not null references public.ai_executives (id),
  contributor_executive_ids uuid[] not null default '{}',
  status text not null default 'QUEUED' check (status in ('DRAFT','QUEUED','ROUTING','IN_PROGRESS','AWAITING_REVIEW','REVISION_REQUESTED','COMPLETED','FAILED','ARCHIVED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  provider text, model text,
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.production_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  version int not null, artifact_type text not null, content text not null,
  file_id uuid references public.files (id) on delete set null,
  revision_note text,
  simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  proposed_by_executive_id uuid not null references public.ai_executives (id),
  action_type text not null,
  summary text not null, payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXECUTED')),
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null, title text not null, message text not null, target_url text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (organization_id, user_id, created_at desc);

create table public.ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  executive_id uuid references public.ai_executives (id) on delete set null,
  provider text not null, model text not null, request_type text not null,
  input_tokens int not null default 0, output_tokens int not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0, latency_ms int not null default 0,
  correlation_id text not null, success boolean not null,
  created_at timestamptz not null default now()
);
create index usage_org_idx on public.ai_usage_records (organization_id, created_at desc);

create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  encrypted_secret text not null,            -- AES-256-GCM with CREDENTIALS_ENCRYPTION_KEY; never selected by clients
  last_four text not null,
  preferred_model text, fallback_model text, monthly_usage_limit_usd numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,  -- null for platform-level auth events
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);
create index audit_org_idx on public.audit_logs (organization_id, timestamp desc);
