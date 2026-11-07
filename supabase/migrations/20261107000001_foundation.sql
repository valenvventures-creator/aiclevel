-- =============================================================================
-- Thought Authorities — A.I. C-Suite
-- Migration 001: Foundation — identity, organizations, membership, RLS helpers
-- =============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  display_name text,
  avatar_url text,
  timezone text not null default 'America/New_York',
  email_verified boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, email_verified)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'first_name', ''),
          coalesce(new.raw_user_meta_data ->> 'last_name', ''),
          new.email_confirmed_at is not null);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organizations & membership
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  logo_url text,
  owner_id uuid not null references public.profiles (id),
  industry text,
  subscription_status text not null default 'TRIAL'
    check (subscription_status in ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','EXECUTIVE','MEMBER','ADVISOR','VIEWER')),
  title text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('ADMIN','EXECUTIVE','MEMBER','ADVISOR','VIEWER')),
  token_hash text not null unique,                 -- SHA-256 of the token; raw token never stored
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (organization_id);

create table public.organization_constitutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  mission text not null default '', vision text not null default '', values text not null default '',
  business_model text not null default '', leadership_philosophy text not null default '',
  strategic_priorities text not null default '', current_priorities text not null default '',
  risk_tolerance text not null default 'BALANCED' check (risk_tolerance in ('CONSERVATIVE','BALANCED','AGGRESSIVE')),
  brand_voice text not null default '', primary_audiences text not null default '',
  financial_objectives text not null default '', technology_objectives text not null default '',
  impact_objectives text not null default '', key_relationships text not null default '',
  important_restrictions text not null default '', decision_principles text not null default '',
  operating_philosophy text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER, stable, search_path pinned)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m
                 where m.organization_id = org and m.user_id = auth.uid() and m.status = 'ACTIVE');
$$;

create or replace function public.has_org_role(org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m
                 where m.organization_id = org and m.user_id = auth.uid()
                   and m.status = 'ACTIVE' and m.role = any (roles));
$$;

-- Role sets mirrored from src/server/auth/permissions.ts
create or replace function public.can_write(org uuid) returns boolean
language sql stable as $$ select public.has_org_role(org, array['OWNER','ADMIN','EXECUTIVE','MEMBER']) $$;
create or replace function public.can_admin(org uuid) returns boolean
language sql stable as $$ select public.has_org_role(org, array['OWNER','ADMIN']) $$;

-- ---------------------------------------------------------------------------
-- Bootstrap RPC: create organization + OWNER membership atomically
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text, p_industry text, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name, slug, owner_id, industry) values (p_name, p_slug, auth.uid(), p_industry)
    returning id into v_org;
  insert into organization_members (organization_id, user_id, role, title) values (v_org, auth.uid(), 'OWNER', p_title);
  return v_org;
end $$;

-- Accept an invitation. Called with the service role after the server has
-- verified the token and that the signed-in user's email matches.
create or replace function public.accept_invitation(p_token_hash text, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv invitations;
begin
  select * into v_inv from invitations where token_hash = p_token_hash for update;
  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invalid invitation';
  end if;
  insert into organization_members (organization_id, user_id, role)
    values (v_inv.organization_id, p_user_id, v_inv.role)
    on conflict (organization_id, user_id) do nothing;     -- only ever the invitation's own organization
  update invitations set accepted_at = now() where id = v_inv.id;
  update profiles set onboarding_completed = true where id = p_user_id;
  return v_inv.organization_id;
end $$;
revoke execute on function public.accept_invitation(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.organization_constitutions enable row level security;

create policy "profiles: self read" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from organization_members a join organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = profiles.id and a.status = 'ACTIVE'));
create policy "profiles: self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "orgs: members read" on public.organizations for select using (public.is_org_member(id));
create policy "orgs: admins update" on public.organizations for update using (public.can_admin(id)) with check (public.can_admin(id));
-- inserts only via create_organization(); deletes only via service role (protected owner flow)

create policy "members: members read" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "members: admins update non-owners" on public.organization_members for update
  using (public.can_admin(organization_id) and role <> 'OWNER' and user_id <> auth.uid())
  with check (public.can_admin(organization_id) and role <> 'OWNER');

create policy "invites: admins all" on public.invitations for all
  using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));

create policy "constitution: members read" on public.organization_constitutions for select using (public.is_org_member(organization_id));
create policy "constitution: admins write" on public.organization_constitutions for all
  using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));
