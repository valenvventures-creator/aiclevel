import type { Metadata } from "next";
import Link from "next/link";
import { ContactRound, Mail, Phone, Plus, Search, Upload } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, Select } from "@/components/ui/primitives";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_STATUS_TONE, STAGE_BY_KEY, contactName, formatMoney } from "@/config/crm";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { matchesContact } from "@/server/crm/service";
import { crmPageContext } from "@/server/crm/page-context";
import { CRM_LEAD_SOURCES, CRM_LEAD_STATUSES, type CrmContact } from "@/types/domain";

export const metadata: Metadata = { title: "CRM Contacts" };

const PAGE = 50;
const SORTS = { updated: "Last updated", name: "Name A–Z", company: "Company A–Z", created: "Newest" } as const;

export default async function ContactsPage({ searchParams }: PageProps<"/crm/contacts">) {
  const { ctx, allowed, canWrite, canTransfer, owners } = await crmPageContext();
  if (!allowed) return null;
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").trim();
  const status = str("status");
  const source = str("source");
  const owner = str("owner");
  const tag = str("tag");
  const sort = (str("sort") in SORTS ? str("sort") : "updated") as keyof typeof SORTS;
  const page = Math.max(1, Number(str("page")) || 1);

  const orgId = ctx.organization.id;
  const [all, deals] = await Promise.all([db().crmContacts.list(orgId), db().crmDeals.list(orgId)]);
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const openDeals = new Map<string, { count: number; amount: number; currency: string; stage: string }>();
  for (const d of deals) {
    if (!d.contact_id || d.status !== "OPEN" || STAGE_BY_KEY[d.stage].won) continue;
    const cur = openDeals.get(d.contact_id) ?? { count: 0, amount: 0, currency: d.currency, stage: STAGE_BY_KEY[d.stage].label };
    openDeals.set(d.contact_id, { ...cur, count: cur.count + 1, amount: cur.amount + (d.amount ?? 0) });
  }
  const tags = [...new Set(all.flatMap((c) => c.tags))].sort();

  const filtered = all.filter(
    (c) =>
      matchesContact(c, q) &&
      (!status || c.lead_status === status) &&
      (!source || c.lead_source === source) &&
      (!owner || (owner === "me" ? c.owner_id === ctx.user.id : c.owner_id === owner)) &&
      (!tag || c.tags.includes(tag)),
  );
  const by: Record<keyof typeof SORTS, (a: CrmContact, b: CrmContact) => number> = {
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    created: (a, b) => b.created_at.localeCompare(a.created_at),
    name: (a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
    company: (a, b) => (a.company ?? "￿").localeCompare(b.company ?? "￿"),
  };
  filtered.sort(by[sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const filtering = Boolean(q || status || source || owner || tag);
  /** Link to this list with some filters changed (empty values are dropped). */
  const listHref = (changes: Record<string, string>) => {
    const all = { q, status, source, owner, tag, sort: sort === "updated" ? "" : sort, page: "", ...changes };
    const u = new URLSearchParams(Object.entries(all).filter(([, v]) => v));
    return `/crm/contacts${u.size ? `?${u}` : ""}`;
  };
  const pageHref = (p: number) => listHref({ page: p > 1 ? String(p) : "" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-xl font-semibold">Contacts <span className="font-mono text-sm text-ivory-faint">{all.length}</span></h2>
        {canTransfer && <ButtonLink href="/crm/transfer" variant="ghost" size="sm"><Upload className="size-3.5" /> Import or export</ButtonLink>}
        {canWrite && <ButtonLink href="/crm/contacts/new" size="sm"><Plus className="size-3.5" /> New contact</ButtonLink>}
      </div>

      <form method="get" className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)_auto]" role="search" aria-label="Filter contacts">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ivory-faint" aria-hidden />
          <label htmlFor="c-q" className="sr-only">Search</label>
          <input id="c-q" name="q" type="search" defaultValue={q} placeholder="Name, email, company, phone, tag" className="h-10 w-full rounded-xl border border-line-strong bg-ink-900 pl-9 pr-3 text-sm" />
        </div>
        <Select name="status" defaultValue={status} aria-label="Lead status"><option value="">Any status</option>{CRM_LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</Select>
        <Select name="source" defaultValue={source} aria-label="Lead source"><option value="">Any source</option>{CRM_LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}</Select>
        <Select name="owner" defaultValue={owner} aria-label="Owner"><option value="">Any owner</option><option value="me">My contacts</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        <Select name="sort" defaultValue={sort} aria-label="Sort by">{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <div className="flex gap-2">
          {tags.length > 0 && <Select name="tag" defaultValue={tag} aria-label="Tag" className="lg:hidden"><option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</Select>}
          <Button type="submit" size="sm" variant="outline" className="h-10">Apply</Button>
          {filtering && <ButtonLink href="/crm/contacts" size="sm" variant="ghost" className="h-10">Clear</ButtonLink>}
        </div>
      </form>
      {tags.length > 0 && (
        <div className="hidden flex-wrap items-center gap-1.5 lg:flex" aria-label="Filter by tag">
          <span className="mr-1 text-xs text-ivory-faint">Tags:</span>
          {tags.slice(0, 20).map((t) => (
            <Link key={t} href={listHref({ tag: tag === t ? "" : t })} aria-pressed={tag === t} className={tag === t ? "rounded-full border border-line-gold bg-gold-400/10 px-2.5 py-0.5 text-xs text-gold-200" : "rounded-full border border-line px-2.5 py-0.5 text-xs text-ivory-muted hover:border-line-gold"}>{t}</Link>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={<ContactRound className="size-5" />}
          title="No contacts yet"
          body="Add the people you sell to and work with, or import them from a spreadsheet (CSV, TSV or Excel), including exports from other CRMs."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {canWrite && <ButtonLink href="/crm/contacts/new" size="sm"><Plus className="size-3.5" /> New contact</ButtonLink>}
              {canTransfer && <ButtonLink href="/crm/transfer" size="sm" variant="outline"><Upload className="size-3.5" /> Import contacts</ButtonLink>}
            </div>
          }
        />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ivory-muted">No contacts match these filters. <Link href="/crm/contacts" className="text-gold-300">Clear filters</Link></p>
      ) : (
        <>
          <p className="text-xs text-ivory-faint" role="status">{filtered.length} {filtered.length === 1 ? "contact" : "contacts"}{filtering ? " match" : ""}{pages > 1 ? ` · page ${page} of ${pages}` : ""}</p>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-ink-900/60 font-mono text-[10px] tracking-[0.14em] text-ivory-faint">
                <tr>{["NAME", "COMPANY", "EMAIL", "PHONE", "STATUS", "OWNER", "OPEN DEALS", "UPDATED"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  const od = openDeals.get(c.id);
                  return (
                    <tr key={c.id} className="transition hover:bg-gold-400/[0.03]">
                      <td className="min-w-44 px-4 py-3"><Link href={`/crm/contacts/${c.id}`} className="font-medium hover:text-gold-100">{contactName(c)}</Link>{c.title && <p className="text-xs text-ivory-faint">{c.title}</p>}</td>
                      <td className="px-4 py-3 text-ivory-muted">{c.company ?? "—"}</td>
                      <td className="px-4 py-3">{c.email ? <a href={`mailto:${c.email}`} className="text-ivory-muted hover:text-gold-200">{c.email}</a> : <span className="text-ivory-faint">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ivory-muted">{c.phone ?? c.mobile ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone={LEAD_STATUS_TONE[c.lead_status]}>{LEAD_STATUS_LABEL[c.lead_status]}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3 text-ivory-muted">{c.owner_id ? ownerName.get(c.owner_id) ?? "—" : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{od ? <span className="font-mono text-xs text-gold-200">{od.count} · {formatMoney(od.amount, od.currency)}</span> : <span className="text-ivory-faint">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ivory-faint">{formatRelative(c.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((c) => {
              const od = openDeals.get(c.id);
              return (
                <li key={c.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start gap-2">
                    <Link href={`/crm/contacts/${c.id}`} className="min-w-0 flex-1 font-medium">{contactName(c)}</Link>
                    <Badge tone={LEAD_STATUS_TONE[c.lead_status]}>{LEAD_STATUS_LABEL[c.lead_status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ivory-muted">{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ivory-muted">
                    {c.email && <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1 break-all"><Mail className="size-3 shrink-0" aria-hidden /> {c.email}</a>}
                    {(c.phone ?? c.mobile) && <a href={`tel:${c.phone ?? c.mobile}`} className="inline-flex items-center gap-1"><Phone className="size-3" aria-hidden /> {c.phone ?? c.mobile}</a>}
                    {od && <span className="font-mono text-gold-200">{od.count} open · {formatMoney(od.amount, od.currency)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-center gap-2">
              {page > 1 && <ButtonLink href={pageHref(page - 1)} size="sm" variant="ghost">← Previous</ButtonLink>}
              <span className="text-xs text-ivory-faint">Page {page} of {pages}</span>
              {page < pages && <ButtonLink href={pageHref(page + 1)} size="sm" variant="ghost">Next →</ButtonLink>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
