-- =============================================================================
-- Migration 004: Row Level Security for every tenant-owned table + storage
-- Server code ALSO filters by organization_id from verified membership;
-- RLS is the second, independent wall.
-- =============================================================================

-- Standard collaborative tables: members read; writers (OWNER/ADMIN/EXECUTIVE/MEMBER) write.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','conversations','messages','communications','executive_sessions','executive_session_messages',
    'executive_session_votes','decisions','memory_records','files','reports','production_jobs','production_artifacts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: members read" on public.%1$I for select using (public.is_org_member(organization_id))', t);
    execute format('create policy "%1$s: writers insert" on public.%1$I for insert with check (public.can_write(organization_id))', t);
    execute format('create policy "%1$s: writers update" on public.%1$I for update using (public.can_write(organization_id)) with check (public.can_write(organization_id))', t);
  end loop;
end $$;

-- Private one-on-one conversations: only the owning user (not the whole org).
drop policy "conversations: members read" on public.conversations;
drop policy "conversations: writers update" on public.conversations;
create policy "conversations: owner read" on public.conversations for select using (user_id = auth.uid() and public.is_org_member(organization_id));
create policy "conversations: owner update" on public.conversations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "conversations: owner delete" on public.conversations for delete using (user_id = auth.uid());
drop policy "messages: members read" on public.messages;
create policy "messages: conversation owner read" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "messages: conversation owner delete" on public.messages for delete using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Executive Comms: participants only.
drop policy "communications: members read" on public.communications;
create policy "communications: participants read" on public.communications for select using (
  public.is_org_member(organization_id) and (sender_id = auth.uid() or auth.uid() = any (recipient_user_ids)));
create policy "communications: sender delete drafts" on public.communications for delete using (sender_id = auth.uid() and is_draft);

-- Memory visibility tiers.
drop policy "memory_records: members read" on public.memory_records;
create policy "memory_records: visibility read" on public.memory_records for select using (
  public.is_org_member(organization_id) and (
    visibility = 'ORGANIZATION'
    or (visibility = 'LEADERSHIP' and public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE']))
    or (visibility = 'OWNER_ONLY' and public.has_org_role(organization_id, array['OWNER']))));
create policy "memory_records: operators delete" on public.memory_records for delete using (public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE']));
create policy "files: operators delete" on public.files for delete using (public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE']));

-- Executive configuration & prompts: members read, admins write.
do $$
declare t text;
begin
  foreach t in array array['ai_executives','ai_executive_personas','ai_executive_skills','ai_executive_model_configs','ai_executive_voices','prompt_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: members read" on public.%1$I for select using (public.is_org_member(organization_id))', t);
    execute format('create policy "%1$s: admins write" on public.%1$I for all using (public.can_admin(organization_id)) with check (public.can_admin(organization_id))', t);
  end loop;
end $$;
-- Executive status flips (AVAILABLE/WORKING) by any writer.
create policy "ai_executives: writers status" on public.ai_executives for update using (public.can_write(organization_id)) with check (public.can_write(organization_id));

-- Human CEO leadership intelligence: the owning human CEO only.
alter table public.human_ceo_intelligence enable row level security;
create policy "ceo intelligence: owner only" on public.human_ceo_intelligence for all
  using (owner_user_id = auth.uid() and public.has_org_role(organization_id, array['OWNER']))
  with check (owner_user_id = auth.uid() and public.has_org_role(organization_id, array['OWNER']));

-- Approvals.
alter table public.approval_requests enable row level security;
create policy "approvals: members read" on public.approval_requests for select using (public.is_org_member(organization_id));
create policy "approvals: writers propose" on public.approval_requests for insert with check (public.can_write(organization_id) and status = 'PENDING');
create policy "approvals: operators review" on public.approval_requests for update using (public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE'])) with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE']));

-- Notifications: the recipient only.
alter table public.notifications enable row level security;
create policy "notifications: recipient read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: recipient update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: members create" on public.notifications for insert with check (public.is_org_member(organization_id));

-- Usage: members record, admins read.
alter table public.ai_usage_records enable row level security;
create policy "usage: members insert" on public.ai_usage_records for insert with check (public.is_org_member(organization_id));
create policy "usage: admins read" on public.ai_usage_records for select using (public.can_admin(organization_id));

-- Credentials: no client SELECT at all. Server uses the service role and decrypts server-side.
alter table public.provider_credentials enable row level security;
create policy "credentials: admins write" on public.provider_credentials for insert with check (public.can_admin(organization_id));
create policy "credentials: admins update" on public.provider_credentials for update using (public.can_admin(organization_id)) with check (public.can_admin(organization_id));
revoke select on public.provider_credentials from anon, authenticated;

-- Audit: append-only; admins read.
alter table public.audit_logs enable row level security;
create policy "audit: members append" on public.audit_logs for insert with check (organization_id is not null and public.is_org_member(organization_id));
create policy "audit: admins read" on public.audit_logs for select using (organization_id is not null and public.can_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, first path segment must be the organization id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('organization-files', 'organization-files', false, 20971520)
on conflict (id) do nothing;

create policy "org files: members read" on storage.objects for select
  using (bucket_id = 'organization-files' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org files: writers upload" on storage.objects for insert
  with check (bucket_id = 'organization-files' and public.can_write(((storage.foldername(name))[1])::uuid));
create policy "org files: operators delete" on storage.objects for delete
  using (bucket_id = 'organization-files' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['OWNER','ADMIN','EXECUTIVE']));
