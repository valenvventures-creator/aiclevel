-- =============================================================================
-- Migration 012: files private to one executive
--
-- A file uploaded in an executive's Learning tab belongs to that executive only:
-- it feeds that executive's library, is not listed in Files and is not added to
-- C-Level Memory. Company-wide files (Files tab, onboarding documents) keep
-- executive_id null and are drawn on by all seven executives.
-- =============================================================================

alter table public.files
  add column if not exists executive_id uuid references public.ai_executives (id) on delete cascade;

create index if not exists files_executive_idx on public.files (organization_id, executive_id);
