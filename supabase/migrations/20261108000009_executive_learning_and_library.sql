-- =============================================================================
-- Migration 009: executive learning (feedback → lessons) and the Executive Library
--
-- executive_feedback       a person's 👍/👎 (and correction) on one executive answer
-- executive_lessons        standing guidance for one executive; drafted from
--                          feedback by A.I. (PROPOSED) and applied only once a
--                          person approves it (APPROVED)
-- executive_library_items  reference knowledge for one executive: starter
--                          frameworks shipped with the platform, plus the
--                          organization's own playbooks, references and documents
-- =============================================================================

create table public.executive_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  source_type text not null check (source_type in ('CONVERSATION','SESSION')),
  source_id uuid not null,
  rating text not null check (rating in ('UP','DOWN')),
  comment text not null default '' check (char_length(comment) <= 2000),
  lesson_id uuid,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, source_id, created_by)
);
create index executive_feedback_exec_idx on public.executive_feedback (organization_id, executive_id, created_at desc);

create table public.executive_lessons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  guidance text not null check (char_length(guidance) between 1 and 1200),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','APPROVED','ARCHIVED')),
  origin text not null check (origin in ('FEEDBACK','MANUAL')),
  source_feedback_id uuid references public.executive_feedback (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index executive_lessons_exec_idx on public.executive_lessons (organization_id, executive_id, status);

create table public.executive_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_id uuid not null references public.ai_executives (id) on delete cascade,
  kind text not null check (kind in ('FRAMEWORK','PLAYBOOK','REFERENCE','DOCUMENT')),
  title text not null check (char_length(title) between 1 and 160),
  content text not null check (char_length(content) <= 20000),
  file_id uuid references public.files (id) on delete set null,
  origin text not null check (origin in ('STARTER','ORGANIZATION')),
  starter_key text,
  enabled boolean not null default true,
  embedding vector(256),                  -- lexical v1 embedding written by the application
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, executive_id, starter_key)
);
create index executive_library_exec_idx on public.executive_library_items (organization_id, executive_id, enabled);

alter table public.executive_feedback enable row level security;
alter table public.executive_lessons enable row level security;
alter table public.executive_library_items enable row level security;

-- Feedback: members read; anyone who may use the executives rates (as themselves); only the author may change or remove it.
create policy "executive_feedback: members read" on public.executive_feedback for select using (public.is_org_member(organization_id));
create policy "executive_feedback: members rate" on public.executive_feedback for insert with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy "executive_feedback: author update" on public.executive_feedback for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "executive_feedback: author delete" on public.executive_feedback for delete using (created_by = auth.uid());

-- Lessons: members read; members may only propose (from their own feedback); admins approve, edit and archive.
create policy "executive_lessons: members read" on public.executive_lessons for select using (public.is_org_member(organization_id));
create policy "executive_lessons: members propose" on public.executive_lessons for insert with check (public.is_org_member(organization_id) and status = 'PROPOSED' and created_by = auth.uid());
create policy "executive_lessons: admins manage" on public.executive_lessons for all using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));

-- Library: members read; admins curate.
create policy "executive_library_items: members read" on public.executive_library_items for select using (public.is_org_member(organization_id));
create policy "executive_library_items: admins manage" on public.executive_library_items for all using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));
