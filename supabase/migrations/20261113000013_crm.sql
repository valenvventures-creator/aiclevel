-- =============================================================================
-- Migration 013: CRM — contacts, sales pipeline (deals) and activities
--
-- crm_contacts    the organization's contact database
-- crm_deals       opportunities moving through the pipeline:
--                 PROSPECT → APPROACH_CONTACT → PRESENTATION → FOLLOW_UP → CLOSE
--                 → ONBOARD → MANAGE (Onboard and Manage are won stages)
-- crm_activities  notes, calls, meetings, tasks, emails and stage changes
--
-- Access: members except Advisors read; Owner/Admin/Executive/Member write;
-- Owner/Admin/Executive delete (import/export is checked in the application).
-- =============================================================================

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  email text check (char_length(email) <= 254),
  phone text, mobile text, title text, company text, website text, industry text,
  lead_source text,
  lead_status text not null default 'NEW' check (lead_status in ('NEW','ATTEMPTED_TO_CONTACT','CONTACTED','QUALIFIED','NOT_QUALIFIED','CUSTOMER','LOST')),
  owner_id uuid references auth.users (id) on delete set null,
  street text, city text, state text, postal_code text, country text, linkedin text,
  tags text[] not null default '{}',
  description text check (char_length(description) <= 5000),
  email_opt_out boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_contacts_org_idx on public.crm_contacts (organization_id, updated_at desc);
create index crm_contacts_email_idx on public.crm_contacts (organization_id, lower(email));

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  company text,
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  stage text not null check (stage in ('PROSPECT','APPROACH_CONTACT','PRESENTATION','FOLLOW_UP','CLOSE','ONBOARD','MANAGE')),
  probability int not null default 10 check (probability between 0 and 100),
  expected_close date,
  deal_type text check (deal_type in ('NEW_BUSINESS','EXISTING_BUSINESS','RENEWAL')),
  lead_source text,
  next_step text check (char_length(next_step) <= 300),
  description text check (char_length(description) <= 5000),
  owner_id uuid references auth.users (id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN','LOST')),
  lost_reason text,
  stage_changed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_deals_board_idx on public.crm_deals (organization_id, status, stage);
create index crm_deals_contact_idx on public.crm_deals (organization_id, contact_id);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('NOTE','CALL','MEETING','TASK','EMAIL','STAGE_CHANGE')),
  subject text not null check (char_length(subject) between 1 and 200),
  details text check (char_length(details) <= 5000),
  due_at timestamptz,
  done boolean not null default false,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  deal_id uuid references public.crm_deals (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_activities_contact_idx on public.crm_activities (organization_id, contact_id, created_at desc);
create index crm_activities_deal_idx on public.crm_activities (organization_id, deal_id, created_at desc);

alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_activities enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_contacts','crm_deals','crm_activities'] loop
    execute format('create policy "%1$s: read" on public.%1$I for select using (public.has_org_role(organization_id, array[''OWNER'',''ADMIN'',''EXECUTIVE'',''MEMBER'',''VIEWER'']))', t);
    execute format('create policy "%1$s: insert" on public.%1$I for insert with check (public.has_org_role(organization_id, array[''OWNER'',''ADMIN'',''EXECUTIVE'',''MEMBER'']))', t);
    execute format('create policy "%1$s: update" on public.%1$I for update using (public.has_org_role(organization_id, array[''OWNER'',''ADMIN'',''EXECUTIVE'',''MEMBER''])) with check (public.has_org_role(organization_id, array[''OWNER'',''ADMIN'',''EXECUTIVE'',''MEMBER'']))', t);
    execute format('create policy "%1$s: delete" on public.%1$I for delete using (public.has_org_role(organization_id, array[''OWNER'',''ADMIN'',''EXECUTIVE'']))', t);
  end loop;
end $$;
