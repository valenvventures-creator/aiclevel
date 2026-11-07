-- =============================================================================
-- Migration 005: allow deleting reports
-- Operators (Owner, Admin, Executive) may delete any report in their
-- organization; other writers may delete reports they created. Mirrors
-- canDeleteReport() in src/server/auth/permissions.ts.
-- =============================================================================
create policy "reports: operators or creator delete" on public.reports for delete using (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EXECUTIVE'])
  or (created_by = auth.uid() and public.can_write(organization_id))
);
