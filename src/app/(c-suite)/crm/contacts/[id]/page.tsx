import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Globe, Mail, MapPin, Phone, Plus, Smartphone, Trash2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmButton } from "@/components/crm/confirm-button";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { ActivityForm } from "@/components/crm/activity-form";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { ContactForm } from "@/components/crm/forms";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_STATUS_TONE, STAGE_BY_KEY, contactName, formatMoney } from "@/config/crm";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { deleteContactAction } from "@/server/crm/actions";
import { crmPageContext } from "@/server/crm/page-context";

export const metadata: Metadata = { title: "Contact" };

/** Only http(s) links are rendered as links (contact data is user-entered). */
const safeUrl = (u: string | null) => {
  if (!u) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export default async function ContactPage({ params }: PageProps<"/crm/contacts/[id]">) {
  const { id } = await params;
  const { ctx, allowed, canWrite, canDelete, owners } = await crmPageContext();
  if (!allowed) return null;
  const orgId = ctx.organization.id;
  const contact = await db().crmContacts.get(orgId, id);
  if (!contact) notFound();
  const [deals, activities] = await Promise.all([db().crmDeals.list(orgId, { where: { contact_id: contact.id } }), db().crmActivities.list(orgId, { where: { contact_id: contact.id } })]);
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const dealName = new Map(deals.map((d) => [d.id, d.name]));
  const sorted = [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const website = safeUrl(contact.website);
  const linkedin = safeUrl(contact.linkedin);
  const address = [contact.street, [contact.city, contact.state, contact.postal_code].filter(Boolean).join(", "), contact.country].filter(Boolean);

  return (
    <div className="space-y-6">
      <Link href="/crm/contacts" className="text-xs text-ivory-muted hover:text-ivory">← Contacts</Link>
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-line-gold bg-gold-400/[0.08] font-heading text-lg text-gold-200">
            {(contact.first_name[0] ?? "") + (contact.last_name[0] ?? "")}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-3xl font-semibold">{contactName(contact)}</h2>
            <p className="mt-0.5 text-sm text-ivory-muted">{[contact.title, contact.company].filter(Boolean).join(" · ") || "—"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={LEAD_STATUS_TONE[contact.lead_status]}>{LEAD_STATUS_LABEL[contact.lead_status]}</Badge>
              {contact.lead_source && <Badge tone="neutral">{LEAD_SOURCE_LABEL[contact.lead_source]}</Badge>}
              {contact.email_opt_out && <Badge tone="warn">Email opt-out</Badge>}
              {contact.tags.map((t) => <Link key={t} href={`/crm/contacts?tag=${encodeURIComponent(t)}`}><Badge tone="gold">{t}</Badge></Link>)}
            </div>
          </div>
          {canWrite && <ButtonLink href={`/crm/deals/new?contact=${contact.id}`} size="sm"><Plus className="size-3.5" /> New deal</ButtonLink>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle>Deals</SectionTitle>
            {deals.length === 0 ? (
              <p className="text-sm text-ivory-muted">No deals yet.{canWrite && <> <Link href={`/crm/deals/new?contact=${contact.id}`} className="text-gold-300">Create one</Link>.</>}</p>
            ) : (
              <ul className="divide-y divide-line">
                {deals.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <Link href={`/crm/deals/${d.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-gold-100">{d.name}</Link>
                    <Badge tone={d.status === "LOST" ? "risk" : STAGE_BY_KEY[d.stage].won ? "ok" : "gold"}>{d.status === "LOST" ? "Lost" : STAGE_BY_KEY[d.stage].label}</Badge>
                    <span className="font-mono text-xs text-gold-200">{formatMoney(d.amount, d.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {canWrite && (
            <Card>
              <SectionTitle>Log activity</SectionTitle>
              <ActivityForm contactId={contact.id} />
            </Card>
          )}
          <Card>
            <SectionTitle>History</SectionTitle>
            <ActivityTimeline activities={sorted} authorName={(uid) => (uid ? ownerName.get(uid) ?? "Former member" : "System")} canWrite={canWrite} contextLabel={(a) => (a.deal_id ? dealName.get(a.deal_id) ?? null : null)} />
          </Card>
          {canWrite && (
            <Card>
              <details>
                <summary className="cursor-pointer list-none font-heading text-lg font-semibold">Edit contact</summary>
                <div className="mt-4"><ContactForm contact={contact} owners={owners} meId={ctx.user.id} /></div>
              </details>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <SectionTitle>Contact details</SectionTitle>
            <ul className="space-y-2.5 text-sm">
              {contact.email && <li className="flex items-center gap-2"><Mail className="size-4 shrink-0 text-ivory-faint" aria-hidden /><a href={`mailto:${contact.email}`} className="min-w-0 break-all hover:text-gold-200">{contact.email}</a></li>}
              {contact.phone && <li className="flex items-center gap-2"><Phone className="size-4 shrink-0 text-ivory-faint" aria-hidden /><a href={`tel:${contact.phone}`} className="hover:text-gold-200">{contact.phone}</a></li>}
              {contact.mobile && <li className="flex items-center gap-2"><Smartphone className="size-4 shrink-0 text-ivory-faint" aria-hidden /><a href={`tel:${contact.mobile}`} className="hover:text-gold-200">{contact.mobile}</a></li>}
              {contact.company && <li className="flex items-center gap-2"><Building2 className="size-4 shrink-0 text-ivory-faint" aria-hidden />{contact.company}{contact.industry ? <span className="text-ivory-faint"> · {contact.industry}</span> : null}</li>}
              {website && <li className="flex items-center gap-2"><Globe className="size-4 shrink-0 text-ivory-faint" aria-hidden /><a href={website} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate hover:text-gold-200">{contact.website}</a></li>}
              {linkedin && <li className="flex items-center gap-2"><Globe className="size-4 shrink-0 text-ivory-faint" aria-hidden /><a href={linkedin} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate hover:text-gold-200">LinkedIn profile</a></li>}
              {address.length > 0 && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ivory-faint" aria-hidden /><span>{address.map((l) => <span key={l} className="block">{l}</span>)}</span></li>}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ivory-faint">Owner</dt><dd>{contact.owner_id ? ownerName.get(contact.owner_id) ?? "Former member" : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivory-faint">Created</dt><dd>{formatRelative(contact.created_at)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivory-faint">Updated</dt><dd>{formatRelative(contact.updated_at)}</dd></div>
            </dl>
            {contact.description && <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm text-ivory-muted">{contact.description}</p>}
          </Card>
          {canDelete && (
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <ConfirmButton message={`Delete ${contactName(contact)} and their activity history? Their deals are kept. This cannot be undone.`} className="w-full text-risk"><Trash2 className="size-3.5" /> Delete contact</ConfirmButton>
              <p className="mt-1 text-center text-[11px] text-ivory-faint">Its deals are kept, without a contact.</p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
