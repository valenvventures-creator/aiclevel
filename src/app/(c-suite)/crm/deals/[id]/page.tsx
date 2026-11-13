import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, Input, Label, SectionTitle } from "@/components/ui/primitives";
import { ActivityForm } from "@/components/crm/activity-form";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { DealForm } from "@/components/crm/forms";
import { StageBar } from "@/components/crm/stage-bar";
import { ConfirmButton } from "@/components/crm/confirm-button";
import { DEAL_TYPE_LABEL, LEAD_SOURCE_LABEL, STAGE_BY_KEY, contactName, formatMoney } from "@/config/crm";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { deleteDealAction, setDealLostAction } from "@/server/crm/actions";
import { crmPageContext } from "@/server/crm/page-context";

export const metadata: Metadata = { title: "Deal" };

export default async function DealPage({ params }: PageProps<"/crm/deals/[id]">) {
  const { id } = await params;
  const { ctx, allowed, canWrite, canDelete, owners } = await crmPageContext();
  if (!allowed) return null;
  const orgId = ctx.organization.id;
  const deal = await db().crmDeals.get(orgId, id);
  if (!deal) notFound();
  const [contacts, activities] = await Promise.all([db().crmContacts.list(orgId), db().crmActivities.list(orgId, { where: { deal_id: deal.id } })]);
  const contact = deal.contact_id ? contacts.find((c) => c.id === deal.contact_id) : undefined;
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const stage = STAGE_BY_KEY[deal.stage];
  const lost = deal.status === "LOST";
  const sorted = [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const objective = `Review the ${deal.name} deal${deal.company ? ` with ${deal.company}` : ""} (${stage.label}, ${formatMoney(deal.amount, deal.currency)}). What should we do next to move it forward?`;

  const facts: [string, string][] = [
    ["Amount", formatMoney(deal.amount, deal.currency)],
    ["Probability", `${deal.probability}%`],
    ["Weighted value", deal.amount === null ? "—" : formatMoney((deal.amount * deal.probability) / 100, deal.currency)],
    ["Expected close", deal.expected_close ? new Date(`${deal.expected_close}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"],
    ["Owner", deal.owner_id ? ownerName.get(deal.owner_id) ?? "Former member" : "—"],
    ["Type", deal.deal_type ? DEAL_TYPE_LABEL[deal.deal_type] : "—"],
    ["Lead source", deal.lead_source ? LEAD_SOURCE_LABEL[deal.lead_source] : "—"],
    ["In this stage since", formatRelative(deal.stage_changed_at)],
    ["Created", formatRelative(deal.created_at)],
  ];

  return (
    <div className="space-y-6">
      <Link href="/crm" className="text-xs text-ivory-muted hover:text-ivory">← Pipeline</Link>
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lost ? "risk" : stage.won ? "ok" : "gold"}>{lost ? "Lost" : stage.won ? "Won" : "Open"}</Badge>
              <Badge tone="neutral">{stage.label}</Badge>
            </div>
            <h2 className="mt-2 font-heading text-3xl font-semibold">{deal.name}</h2>
            <p className="mt-1 text-sm text-ivory-muted">
              {deal.company}
              {contact && <>{deal.company ? " · " : ""}<Link href={`/crm/contacts/${contact.id}`} className="text-gold-300 hover:text-gold-200">{contactName(contact)}</Link>{contact.title ? `, ${contact.title}` : ""}</>}
            </p>
          </div>
          <p className="font-heading text-3xl text-gold-100">{formatMoney(deal.amount, deal.currency)}</p>
        </div>
        {lost ? (
          <p className="rounded-xl border border-risk/25 bg-risk/[0.05] px-4 py-3 text-sm text-ivory-muted">Lost while in {stage.label}{deal.lost_reason ? `: ${deal.lost_reason}` : "."} It is off the board; reopen it to put it back.</p>
        ) : (
          <StageBar dealId={deal.id} stage={deal.stage} canMove={canWrite} />
        )}
        {deal.next_step && <p className="text-sm"><span className="text-ivory-faint">Next step: </span>{deal.next_step}</p>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {canWrite && (
            <Card>
              <SectionTitle>Log activity</SectionTitle>
              <ActivityForm dealId={deal.id} contactId={deal.contact_id} />
            </Card>
          )}
          <Card>
            <SectionTitle>History</SectionTitle>
            <ActivityTimeline activities={sorted} authorName={(uid) => (uid ? ownerName.get(uid) ?? "Former member" : "System")} canWrite={canWrite} />
          </Card>
          {canWrite && (
            <Card>
              <details>
                <summary className="cursor-pointer list-none font-heading text-lg font-semibold">Edit deal</summary>
                <div className="mt-4">
                  <DealForm deal={deal} contacts={contacts.map((c) => ({ id: c.id, name: contactName(c), company: c.company }))} owners={owners} meId={ctx.user.id} />
                </div>
              </details>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <SectionTitle>Key facts</SectionTitle>
            <dl className="space-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-ivory-faint">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
            {deal.description && <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm text-ivory-muted">{deal.description}</p>}
          </Card>
          <Card className="space-y-3">
            <SectionTitle>Get the C-Level&apos;s view</SectionTitle>
            <p className="text-xs text-ivory-muted">Convene the executives on this deal: pricing, risks, the pitch and what to do next.</p>
            <ButtonLink href={`/sessions/new?objective=${encodeURIComponent(objective)}`} size="sm" variant="outline" className="w-full"><Users className="size-3.5" /> Discuss in a C-Level Session</ButtonLink>
          </Card>
          {canWrite && (
            <Card className="space-y-3">
              <SectionTitle>{lost ? "Reopen" : "Mark as lost"}</SectionTitle>
              <form action={setDealLostAction} className="space-y-2">
                <input type="hidden" name="id" value={deal.id} />
                <input type="hidden" name="lost" value={lost ? "0" : "1"} />
                {!lost && (
                  <div>
                    <Label htmlFor="lost-reason">Reason (optional)</Label>
                    <Input id="lost-reason" name="reason" maxLength={300} placeholder="e.g. Chose a competitor, budget cut" />
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full">{lost ? "Reopen deal" : "Mark as lost"}</Button>
              </form>
              {canDelete && (
                <form action={deleteDealAction}>
                  <input type="hidden" name="id" value={deal.id} />
                  <ConfirmButton message={`Delete “${deal.name}” and its history? This cannot be undone. (To keep it, mark it as lost instead.)`} className="w-full text-risk"><Trash2 className="size-3.5" /> Delete deal</ConfirmButton>
                </form>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
