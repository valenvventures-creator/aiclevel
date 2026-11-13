import "server-only";
import { CRM_PIPELINE, DEAL_TYPE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, STAGE_BY_KEY } from "@/config/crm";
import { db, newId, nowIso } from "@/server/db/store";
import { listTeam } from "@/server/organizations/service";
import { CRM_DEAL_TYPES, CRM_LEAD_SOURCES, CRM_LEAD_STATUSES, type CrmActivity, type CrmContact, type CrmDeal } from "@/types/domain";
import { CONTACT_COLUMNS, DEAL_COLUMNS } from "@/config/crm-columns";
import { ContactInput, DealInput } from "./service";
import { excelSerialToDate, type Rows } from "./spreadsheet";

/**
 * CRM import and export: the spreadsheet columns for contacts and deals,
 * automatic column matching (including Zoho CRM export headers), value
 * conversion and validation, and duplicate handling.
 */
export type { CrmEntity } from "@/config/crm-columns";
import type { CrmEntity } from "@/config/crm-columns";

export const columnsFor = (entity: CrmEntity) => (entity === "contacts" ? CONTACT_COLUMNS : DEAL_COLUMNS);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Suggests which CRM field each spreadsheet column fills ("" = skip). Each field is used at most once. Pure. */
export function suggestMapping(headers: string[], entity: CrmEntity): string[] {
  const cols = columnsFor(entity);
  const used = new Set<string>();
  return headers.map((h) => {
    const n = norm(h);
    if (!n) return "";
    const hit = cols.find((c) => !used.has(c.key) && (norm(c.key) === n || norm(c.header) === n || c.aliases.some((a) => norm(a) === n)));
    if (!hit) return "";
    used.add(hit.key);
    return hit.key;
  });
}

/* ------------------------------ value conversion ------------------------------ */

/** Matches a label or a code (e.g. "Trade show" or "TRADE_SHOW"). */
function enumFrom<T extends string>(value: string, codes: readonly T[], labels: Record<T, string>): T | null {
  const n = norm(value);
  if (!n) return null;
  return codes.find((c) => norm(c) === n || norm(labels[c]) === n) ?? null;
}

const STAGE_ALIASES: Record<string, (typeof CRM_PIPELINE)[number]["key"]> = {
  // Common stage names from other CRMs, Zoho's defaults included.
  qualification: "PROSPECT", lead: "PROSPECT", new: "PROSPECT", prospecting: "PROSPECT",
  contacted: "APPROACH_CONTACT", approach: "APPROACH_CONTACT", contact: "APPROACH_CONTACT", needsanalysis: "APPROACH_CONTACT", discovery: "APPROACH_CONTACT",
  valueproposition: "PRESENTATION", proposal: "PRESENTATION", proposalpricequote: "PRESENTATION", demo: "PRESENTATION", idwdecisionmakers: "PRESENTATION", identifydecisionmakers: "PRESENTATION",
  followup: "FOLLOW_UP", perceptionanalysis: "FOLLOW_UP", negotiation: "FOLLOW_UP", negotiationreview: "FOLLOW_UP",
  closing: "CLOSE", contractsent: "CLOSE", closedlost: "CLOSE", lost: "CLOSE", // imported as lost (status), kept in Close closedwon: "ONBOARD", won: "ONBOARD", onboarding: "ONBOARD",
  customer: "MANAGE", active: "MANAGE", account: "MANAGE", management: "MANAGE",
};

function stageFrom(value: string) {
  const n = norm(value);
  if (!n) return null;
  return CRM_PIPELINE.find((s) => norm(s.key) === n || norm(s.label) === n)?.key ?? STAGE_ALIASES[n] ?? null;
}

const bool = (v: string) => /^(true|yes|y|1|x|checked)$/i.test(v.trim());

/** Spreadsheet date (ISO, US m/d/yyyy, or an Excel day number) → YYYY-MM-DD, or null. */
export function dateFrom(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToDate(Number(s));
  const us = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Undo the export's formula guard (a leading apostrophe) on the way back in. */
const unguard = (v: string) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v).trim();

/* ---------------------------------- import --------------------------------- */

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface ImportRequest {
  entity: CrmEntity;
  headers: string[];
  rows: Rows;
  /** Field key for each column ("" = skip). */
  mapping: string[];
  /** What to do with a contact whose email already exists. */
  duplicates: "skip" | "update";
}

function recordFrom(row: string[], mapping: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  mapping.forEach((key, i) => {
    if (key && row[i] !== undefined && unguard(row[i]) !== "") out[key] = unguard(row[i]);
  });
  return out;
}

const MAX_ERRORS = 50;

export async function importRows(orgId: string, userId: string, req: ImportRequest): Promise<ImportResult> {
  const team = await listTeam(orgId);
  const ownerByEmail = new Map(team.filter((m) => m.profile?.email).map((m) => [m.profile!.email.toLowerCase(), m.user_id]));
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const fail = (row: number, message: string) => {
    result.skipped++;
    if (result.errors.length < MAX_ERRORS) result.errors.push({ row, message });
  };
  const now = nowIso();
  const contacts = await db().crmContacts.list(orgId);
  const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));

  if (req.entity === "contacts") {
    const creates: CrmContact[] = [];
    for (const [i, row] of req.rows.entries()) {
      const r = recordFrom(row, req.mapping);
      if (r.full_name && !r.last_name) {
        const parts = r.full_name.split(/\s+/);
        r.last_name = parts.length > 1 ? parts.pop()! : parts[0];
        r.first_name ??= parts.length ? parts.join(" ") : "";
      }
      const parsed = ContactInput.safeParse({
        ...r,
        lead_source: r.lead_source ? enumFrom(r.lead_source, CRM_LEAD_SOURCES, LEAD_SOURCE_LABEL) ?? "OTHER" : null,
        lead_status: r.lead_status ? enumFrom(r.lead_status, CRM_LEAD_STATUSES, LEAD_STATUS_LABEL) ?? "NEW" : "NEW",
        owner_id: r.owner ? ownerByEmail.get(r.owner.toLowerCase()) ?? null : null,
        tags: r.tags?.split(/[,;|]/) ?? [],
        email_opt_out: r.email_opt_out ? bool(r.email_opt_out) : false,
      });
      if (!parsed.success) {
        fail(i + 2, parsed.error.issues[0]?.message ?? "Invalid row.");
        continue;
      }
      const input = parsed.data;
      const existing = input.email ? byEmail.get(input.email) : undefined;
      if (existing) {
        if (req.duplicates === "update") {
          // Only fill what the spreadsheet provides; keep everything else.
          const patch = Object.fromEntries(Object.entries(input).filter(([k, v]) => (r[k] !== undefined || (k === "last_name" && r.full_name)) && v !== null)) as Partial<CrmContact>;
          await db().crmContacts.update(orgId, existing.id, { ...patch, updated_at: now });
          result.updated++;
        } else result.skipped++;
        continue;
      }
      const c: CrmContact = { id: newId(), organization_id: orgId, ...input, owner_id: input.owner_id ?? userId, created_by: userId, created_at: now, updated_at: now };
      creates.push(c);
      if (c.email) byEmail.set(c.email, c);
    }
    for (let i = 0; i < creates.length; i += 200) await db().crmContacts.insertMany(creates.slice(i, i + 200));
    result.created = creates.length;
    return result;
  }

  // Deals: link to an existing contact by email, then by full name.
  const byName = new Map(contacts.map((c) => [norm(`${c.first_name}${c.last_name}`), c]));
  const deals: CrmDeal[] = [];
  const activities: CrmActivity[] = [];
  for (const [i, row] of req.rows.entries()) {
    const r = recordFrom(row, req.mapping);
    const contact = (r.contact_email && byEmail.get(r.contact_email.toLowerCase())) || (r.contact_name && byName.get(norm(r.contact_name))) || null;
    const stage = r.stage ? stageFrom(r.stage) : "PROSPECT";
    if (!stage) {
      fail(i + 2, `Unknown stage “${r.stage}”. Use one of: ${CRM_PIPELINE.map((s) => s.label).join(", ")}.`);
      continue;
    }
    const lost = r.status ? /lost/i.test(r.status) : r.stage ? /lost/i.test(r.stage) : false;
    const parsed = DealInput.safeParse({
      ...r,
      stage,
      probability: r.probability ? r.probability.replace("%", "") : null,
      expected_close: r.expected_close ? dateFrom(r.expected_close) : null,
      deal_type: r.deal_type ? enumFrom(r.deal_type, CRM_DEAL_TYPES, DEAL_TYPE_LABEL) : null,
      lead_source: r.lead_source ? enumFrom(r.lead_source, CRM_LEAD_SOURCES, LEAD_SOURCE_LABEL) ?? "OTHER" : null,
      currency: r.currency || "USD",
      contact_id: contact?.id ?? null,
      owner_id: r.owner ? ownerByEmail.get(r.owner.toLowerCase()) ?? null : null,
    });
    if (!parsed.success) {
      fail(i + 2, parsed.error.issues[0]?.message ?? "Invalid row.");
      continue;
    }
    const input = parsed.data;
    const deal: CrmDeal = {
      id: newId(), organization_id: orgId, ...input,
      company: input.company ?? contact?.company ?? null,
      probability: input.probability ?? STAGE_BY_KEY[input.stage].probability,
      owner_id: input.owner_id ?? userId,
      status: lost ? "LOST" : "OPEN",
      lost_reason: lost ? r.lost_reason ?? null : null,
      stage_changed_at: now, created_by: userId, created_at: now, updated_at: now,
    };
    deals.push(deal);
    activities.push({ id: newId(), organization_id: orgId, kind: "STAGE_CHANGE", subject: `Imported in ${STAGE_BY_KEY[deal.stage].label}`, details: null, due_at: null, done: true, contact_id: deal.contact_id, deal_id: deal.id, created_by: userId, created_at: now, updated_at: now });
  }
  for (let i = 0; i < deals.length; i += 200) await db().crmDeals.insertMany(deals.slice(i, i + 200));
  for (let i = 0; i < activities.length; i += 200) await db().crmActivities.insertMany(activities.slice(i, i + 200));
  result.created = deals.length;
  return result;
}

/* ---------------------------------- export --------------------------------- */

export async function exportRows(orgId: string, entity: CrmEntity, opts: { template?: boolean } = {}): Promise<Rows> {
  const cols = columnsFor(entity).filter((c) => c.key !== "full_name");
  const header = [...cols.map((c) => c.header), ...(opts.template ? [] : ["Created", "Updated"])];
  if (opts.template) return [header];
  const team = await listTeam(orgId);
  const ownerEmail = new Map(team.map((m) => [m.user_id, m.profile?.email ?? ""]));
  const contacts = await db().crmContacts.list(orgId, { orderBy: "created_at" });
  if (entity === "contacts") {
    return [
      header,
      ...contacts.map((c) =>
        cols
          .map((col) => {
            switch (col.key) {
              case "lead_source": return c.lead_source ? LEAD_SOURCE_LABEL[c.lead_source] : "";
              case "lead_status": return LEAD_STATUS_LABEL[c.lead_status];
              case "owner": return c.owner_id ? ownerEmail.get(c.owner_id) ?? "" : "";
              case "tags": return c.tags.join(", ");
              case "email_opt_out": return c.email_opt_out ? "Yes" : "No";
              default: return String((c as unknown as Record<string, unknown>)[col.key] ?? "");
            }
          })
          .concat([c.created_at.slice(0, 10), c.updated_at.slice(0, 10)]),
      ),
    ];
  }
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const deals = await db().crmDeals.list(orgId, { orderBy: "created_at" });
  return [
    header,
    ...deals.map((d) => {
      const contact = d.contact_id ? contactById.get(d.contact_id) : undefined;
      return cols
        .map((col) => {
          switch (col.key) {
            case "stage": return STAGE_BY_KEY[d.stage].label;
            case "amount": return d.amount === null ? "" : String(d.amount);
            case "probability": return String(d.probability);
            case "deal_type": return d.deal_type ? DEAL_TYPE_LABEL[d.deal_type] : "";
            case "lead_source": return d.lead_source ? LEAD_SOURCE_LABEL[d.lead_source] : "";
            case "contact_email": return contact?.email ?? "";
            case "contact_name": return contact ? `${contact.first_name} ${contact.last_name}`.trim() : "";
            case "owner": return d.owner_id ? ownerEmail.get(d.owner_id) ?? "" : "";
            case "status": return d.status === "LOST" ? "Lost" : STAGE_BY_KEY[d.stage].won ? "Won" : "Open";
            default: return String((d as unknown as Record<string, unknown>)[col.key] ?? "");
          }
        })
        .concat([d.created_at.slice(0, 10), d.updated_at.slice(0, 10)]);
    }),
  ];
}
