-- =============================================================================
-- Migration 002: A.I. C-Suite — executives, prompts, leadership intelligence,
-- conversations, Executive Comms, C-Suite Sessions, decisions
-- =============================================================================

create table public.ai_executives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_code text not null,                                  -- CEO, CFO, CCO, CHRO, CTO, CLO, CIO, CUSTOM_*
  slug text not null,
  title text not null,
  short_title text not null,
  display_name text,
  functional_mandate text not null,
  description text not null default '',
  avatar_url text,
  accent text not null default 'var(--exec-ceo)',
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','WORKING','IN_SESSION','OFFLINE')),
  is_core boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (organization_id, role_code)
);

create table public.ai_executive_personas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null unique references public.ai_executives (id) on delete cascade,
  north_star text not null default '', core_belief text not null default '', leadership_promise text not null default '',
  biography text not null default '', personality text not null default '', communication_style text not null default '',
  decision_style text not null default '', primary_question text not null default '', system_instructions text not null default '',
  reasoning_guidelines text not null default '', output_preferences text not null default '', risk_constraints text not null default ''
);

create table public.ai_executive_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  name text not null, description text not null default '', priority int not null default 1
);

create table public.ai_executive_model_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null unique references public.ai_executives (id) on delete cascade,
  primary_provider text not null default 'anthropic',
  primary_model text not null default 'claude-opus-5-5',
  fallback_provider text, fallback_model text,
  effort text not null default 'high' check (effort in ('low','medium','high','xhigh','max')),
  token_budget int not null default 64000 check (token_budget between 1000 and 128000),
  tool_permissions text[] not null default '{}',
  memory_categories jsonb not null default '"ALL"'::jsonb,   -- "ALL" or ["FINANCE", ...]
  prompt_key text not null
);

create table public.ai_executive_voices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null unique references public.ai_executives (id) on delete cascade,
  provider text not null, voice_id text not null, voice_name text not null,
  settings_json jsonb not null default '{"playback_speed":1}'::jsonb
);

create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,  -- org overrides; platform defaults live in code
  key text not null,
  executive_role text,
  type text not null check (type in ('EXECUTIVE_CORE','SESSION','REVIEW','STUDIO','MEMORY','PLATFORM')),
  version int not null,
  content text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (organization_id, key, version)
);

create table public.human_ceo_intelligence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('PRINCIPLE','DECISION','WRITING','SPEECH','INTERVIEW','PREFERENCE','HISTORY')),
  title text not null, content text not null,
  included boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null, description text not null default '',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ON_HOLD','COMPLETED','ARCHIVED')),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_lookup_idx on public.conversations (organization_id, user_id, executive_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user','executive')),
  content text not null,
  provider text, model text, prompt_version text,
  simulated boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  thread_id uuid not null,
  subject text not null, body text not null,
  sender_type text not null check (sender_type in ('USER','EXECUTIVE')),
  sender_id uuid not null,
  recipient_executive_ids uuid[] not null default '{}',
  recipient_user_ids uuid[] not null default '{}',
  is_draft boolean not null default false, starred boolean not null default false, archived boolean not null default false,
  read_at timestamptz,
  origin_type text check (origin_type in ('FILE','REPORT','CONVERSATION','SESSION','MEMORY','PROJECT','TEMPLATE')),
  origin_id text,
  simulated boolean not null default false,
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,''))) stored
);
create index communications_thread_idx on public.communications (organization_id, thread_id, created_at);
create index communications_search_idx on public.communications using gin (search_document);

create table public.executive_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  title text not null, objective text not null,
  mode text not null,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','RUNNING','ADJOURNED','FAILED')),
  chair_executive_id uuid references public.ai_executives (id) on delete set null,
  participant_executive_ids uuid[] not null check (cardinality(participant_executive_ids) between 1 and 7),
  created_at timestamptz not null default now(),
  started_at timestamptz, ended_at timestamptz
);

create table public.executive_session_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references public.executive_sessions (id) on delete cascade,
  speaker_type text not null check (speaker_type in ('USER','EXECUTIVE','SYSTEM')),
  speaker_id uuid,
  stage text not null,
  content text not null,
  sequence_number int not null,
  provider text, model text, prompt_version text,
  simulated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create table public.executive_session_votes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references public.executive_sessions (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  option_id text not null, score numeric not null default 0, reason text not null default '',
  confidence numeric not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  session_id uuid references public.executive_sessions (id) on delete set null,
  title text not null, question text not null,
  options_json jsonb not null default '[]'::jsonb,
  chosen_option text,
  recommendation text not null, rationale text not null default '',
  risks_json jsonb not null default '[]'::jsonb,
  financial_implications_json jsonb, technology_implications_json jsonb,
  people_implications_json jsonb, impact_implications_json jsonb,
  confidence numeric not null check (confidence between 0 and 1),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','UNDER_REVIEW','APPROVED','REJECTED','DEFERRED')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
