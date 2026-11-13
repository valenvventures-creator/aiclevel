import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ContactRound, Handshake, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { PipelineBoard, type BoardDeal } from "@/components/crm/pipeline-board";
import { ACTIVITY_LABEL, STAGE_BY_KEY, contactName, formatMoney } from "@/config/crm";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { crmPageContext } from "@/server/crm/page-context";

export const metadata: Metadata = { title: "CRM Pipeline" };

export default async function CrmPipelinePage() {
  const { ctx, allowed, canWrite, canTransfer, owners } = await crmPageContext();
  if (!allowed) return null;
  const orgId = ctx.organization.id;
  const [deals, contacts, activities] = await Promise.all([db().crmDeals.list(orgId), db().crmContacts.list(orgId), db().crmActivities.list(orgId)]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const open = deals.filter((d) => d.status === "OPEN");
  const lost = deals.filter((d) => d.status === "LOST").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const board: BoardDeal[] = open
    .sort((a, b) => b.stage_changed_at.localeCompare(a.stage_changed_at))
    .map((d) => ({
      id: d.id, name: d.name, company: d.company, amount: d.amount, currency: d.currency, stage: d.stage, probability: d.probability, expected_close: d.expected_close,
      next_step: d.next_step, owner_id: d.owner_id, status: d.status, stage_changed_at: d.stage_changed_at, contact_id: d.contact_id,
      contactName: d.contact_id && contactById.has(d.contact_id) ? contactName(contactById.get(d.contact_id)!) : null,
    }));
  // The board totals use the most common deal currency.
  const counts = new Map<string, number>();
  for (const d of deals) counts.set(d.currency, (counts.get(d.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const upcoming = activities
    .filter((a) => !a.done && (a.kind === "TASK" || a.kind === "CALL" || a.kind === "MEETING"))
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
    .slice(0, 8);
  // Remount the board only when deals are added or removed, so a move keeps the person's search and filters.
  let hash = 0;
  for (const d of [...open].sort((a, b) => a.id.localeCompare(b.id))) for (const ch of d.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const boardKey = `${open.length}:${hash}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-xl font-semibold">Pipeline</h2>
        {canTransfer && <ButtonLink href="/crm/transfer" variant="ghost" size="sm"><Upload className="size-3.5" /> Import or export</ButtonLink>}
        {canWrite && <ButtonLink href="/crm/contacts/new" variant="outline" size="sm"><ContactRound className="size-3.5" /> New contact</ButtonLink>}
        {canWrite && <ButtonLink href="/crm/deals/new" size="sm"><Plus className="size-3.5" /> New deal</ButtonLink>}
      </div>

      {deals.length === 0 ? (
        <EmptyState
          icon={<Handshake className="size-5" />}
          title="Your pipeline is empty"
          body="Create a deal for each opportunity and move it from Prospect to Manage as it progresses. Already use another CRM? Import your contacts and deals from a spreadsheet."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {canWrite && <ButtonLink href="/crm/deals/new" size="sm"><Plus className="size-3.5" /> New deal</ButtonLink>}
              {canTransfer && <ButtonLink href="/crm/transfer" variant="outline" size="sm"><Upload className="size-3.5" /> Import a spreadsheet</ButtonLink>}
            </div>
          }
        />
      ) : (
        <PipelineBoard key={boardKey} initialDeals={board} lostDeals={lost.map((d) => ({ owner_id: d.owner_id }))} owners={owners.map((o) => ({ id: o.id, name: o.name }))} meId={ctx.user.id} canWrite={canWrite} currency={currency} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Upcoming tasks, calls & meetings</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ivory-muted">Nothing scheduled. Add tasks from a deal or contact.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => {
                const deal = a.deal_id ? dealById.get(a.deal_id) : undefined;
                const contact = a.contact_id ? contactById.get(a.contact_id) : undefined;
                const href = deal ? `/crm/deals/${deal.id}` : contact ? `/crm/contacts/${contact.id}` : "/crm";
                const overdue = a.due_at && a.due_at < new Date().toISOString();
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Badge tone="neutral">{ACTIVITY_LABEL[a.kind]}</Badge>
                    <Link href={href} className="min-w-0 flex-1 truncate hover:text-gold-200">{a.subject}<span className="text-ivory-faint"> · {deal?.name ?? (contact ? contactName(contact) : "")}</span></Link>
                    {a.due_at && <span className={overdue ? "inline-flex shrink-0 items-center gap-1 text-xs text-risk" : "inline-flex shrink-0 items-center gap-1 text-xs text-ivory-muted"}><CalendarClock className="size-3" aria-hidden /> {new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle>Lost deals</SectionTitle>
          {lost.length === 0 ? (
            <p className="text-sm text-ivory-muted">No lost deals. A deal marked as lost leaves the board and is kept here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lost.slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Link href={`/crm/deals/${d.id}`} className="min-w-0 flex-1 truncate hover:text-gold-200">{d.name}<span className="text-ivory-faint"> · was in {STAGE_BY_KEY[d.stage].label}</span></Link>
                  <span className="shrink-0 font-mono text-xs text-ivory-muted">{formatMoney(d.amount, d.currency)}</span>
                  <span className="hidden shrink-0 text-xs text-ivory-faint sm:inline">{formatRelative(d.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
