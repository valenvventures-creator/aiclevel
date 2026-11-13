import "server-only";
import { z } from "zod";
import { STAGE_BY_KEY } from "@/config/crm";
import { db, newId, nowIso } from "@/server/db/store";
import { listTeam } from "@/server/organizations/service";
import {
  CRM_ACTIVITY_KINDS,
  CRM_DEAL_TYPES,
  CRM_LEAD_SOURCES,
  CRM_LEAD_STATUSES,
  CRM_STAGES,
  type CrmActivity,
  type CrmContact,
  type CrmDeal,
  type CrmStage,
} from "@/types/domain";

/**
 * CRM service: the organization's contact database, the sales pipeline
 * (deals moving through seven stages) and the activity timeline. All access
 * is scoped by the organization id from requireContext()/authorize().
 */

/* --------------------------------- inputs -------------------------------- */

/** "" → null, trimmed, length-limited. */
const opt = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const emailOpt = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address.");

const enumOpt = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v): v is T[number] | null => v === null || (values as readonly string[]).includes(v), "Choose a value from the list.") as unknown as z.ZodType<T[number] | null>;

export const ContactInput = z.object({
  first_name: z.string().trim().max(100).default(""),
  last_name: z.string({ error: "Add a last name." }).trim().min(1, "Add a last name.").max(100),
  email: emailOpt,
  phone: opt(40),
  mobile: opt(40),
  title: opt(120),
  company: opt(160),
  website: opt(300),
  industry: opt(120),
  lead_source: enumOpt(CRM_LEAD_SOURCES),
  lead_status: z.enum(CRM_LEAD_STATUSES).default("NEW"),
  owner_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  street: opt(200),
  city: opt(120),
  state: opt(120),
  postal_code: opt(30),
  country: opt(120),
  linkedin: opt(300),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => [...new Set((Array.isArray(v) ? v : (v ?? "").split(",")).map((t) => t.trim()).filter(Boolean))].slice(0, 20).map((t) => t.slice(0, 40))),
  description: opt(5000),
  email_opt_out: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === "on" || v === "true"),
});
export type ContactInputT = z.infer<typeof ContactInput>;

export const DealInput = z.object({
  name: z.string({ error: "Give the deal a name." }).trim().min(1, "Give the deal a name.").max(160),
  contact_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  company: opt(160),
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Enter the amount as a positive number." });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.").default("USD"),
  stage: z.enum(CRM_STAGES).default("PROSPECT"),
  probability: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v)) || 0)))),
  expected_close: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a date like 2026-12-31."),
  deal_type: enumOpt(CRM_DEAL_TYPES),
  lead_source: enumOpt(CRM_LEAD_SOURCES),
  next_step: opt(300),
  description: opt(5000),
  owner_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
});
export type DealInputT = z.infer<typeof DealInput>;

export const ActivityInput = z.object({
  kind: z.enum(CRM_ACTIVITY_KINDS).refine((k) => k !== "STAGE_CHANGE", "Choose an activity type."),
  subject: z.string({ error: "Add a subject." }).trim().min(1, "Add a subject.").max(200),
  details: opt(5000),
  due_at: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v).toISOString() : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid date."),
  contact_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  deal_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
});

/* ------------------------------ ownership checks ------------------------------ */

export class CrmError extends Error {}

async function assertOwner(orgId: string, ownerId: string | null) {
  if (!ownerId) return;
  const team = await listTeam(orgId);
  if (!team.some((m) => m.user_id === ownerId && m.status === "ACTIVE")) throw new CrmError("The owner must be an active member of your organization.");
}

async function assertContact(orgId: string, contactId: string | null) {
  if (contactId && !(await db().crmContacts.get(orgId, contactId))) throw new CrmError("That contact no longer exists.");
}

async function assertDeal(orgId: string, dealId: string | null) {
  if (dealId && !(await db().crmDeals.get(orgId, dealId))) throw new CrmError("That deal no longer exists.");
}

/* --------------------------------- contacts -------------------------------- */

export async function createContact(orgId: string, userId: string, input: ContactInputT): Promise<CrmContact> {
  await assertOwner(orgId, input.owner_id);
  const now = nowIso();
  const row: CrmContact = { id: newId(), organization_id: orgId, ...input, owner_id: input.owner_id ?? userId, created_by: userId, created_at: now, updated_at: now };
  return db().crmContacts.insert(row);
}

export async function updateContact(orgId: string, contactId: string, input: ContactInputT): Promise<CrmContact> {
  await assertOwner(orgId, input.owner_id);
  const updated = await db().crmContacts.update(orgId, contactId, { ...input, updated_at: nowIso() });
  if (!updated) throw new CrmError("Contact not found.");
  return updated;
}

/** Deletes a contact and its activities; its deals stay, unlinked. */
export async function deleteContact(orgId: string, contactId: string): Promise<boolean> {
  const d = db();
  const contact = await d.crmContacts.get(orgId, contactId);
  if (!contact) return false;
  const [deals, activities] = await Promise.all([d.crmDeals.list(orgId, { where: { contact_id: contactId } }), d.crmActivities.list(orgId, { where: { contact_id: contactId } })]);
  await Promise.all(deals.map((deal) => d.crmDeals.update(orgId, deal.id, { contact_id: null, updated_at: nowIso() })));
  await Promise.all(activities.filter((a) => !a.deal_id).map((a) => d.crmActivities.remove(orgId, a.id)));
  await Promise.all(activities.filter((a) => a.deal_id).map((a) => d.crmActivities.update(orgId, a.id, { contact_id: null })));
  return d.crmContacts.remove(orgId, contactId);
}

export async function findContactByEmail(orgId: string, email: string): Promise<CrmContact | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return (await db().crmContacts.list(orgId)).find((c) => c.email?.toLowerCase() === e) ?? null;
}

/* ---------------------------------- deals ---------------------------------- */

export async function createDeal(orgId: string, userId: string, input: DealInputT): Promise<CrmDeal> {
  await Promise.all([assertOwner(orgId, input.owner_id), assertContact(orgId, input.contact_id)]);
  const now = nowIso();
  const contact = input.contact_id ? await db().crmContacts.get(orgId, input.contact_id) : null;
  const row: CrmDeal = {
    id: newId(),
    organization_id: orgId,
    ...input,
    company: input.company ?? contact?.company ?? null,
    probability: input.probability ?? STAGE_BY_KEY[input.stage].probability,
    owner_id: input.owner_id ?? userId,
    status: "OPEN",
    lost_reason: null,
    stage_changed_at: now,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  await db().crmDeals.insert(row);
  await logActivity(orgId, userId, { kind: "STAGE_CHANGE", subject: `Deal created in ${STAGE_BY_KEY[row.stage].label}`, deal_id: row.id, contact_id: row.contact_id });
  return row;
}

export async function updateDeal(orgId: string, userId: string, dealId: string, input: DealInputT): Promise<CrmDeal> {
  await Promise.all([assertOwner(orgId, input.owner_id), assertContact(orgId, input.contact_id)]);
  const deal = await db().crmDeals.get(orgId, dealId);
  if (!deal) throw new CrmError("Deal not found.");
  const stageChanged = input.stage !== deal.stage;
  const now = nowIso();
  const patch: Partial<CrmDeal> = {
    ...input,
    probability: input.probability ?? (stageChanged ? STAGE_BY_KEY[input.stage].probability : deal.probability),
    updated_at: now,
    ...(stageChanged ? { stage_changed_at: now } : {}),
  };
  const updated = (await db().crmDeals.update(orgId, dealId, patch))!;
  if (stageChanged) await logStageChange(orgId, userId, updated, deal.stage);
  return updated;
}

/** Moves a deal to another stage (drag and drop on the board). Probability follows the stage default. */
export async function moveDeal(orgId: string, userId: string, dealId: string, stage: CrmStage): Promise<CrmDeal> {
  const deal = await db().crmDeals.get(orgId, dealId);
  if (!deal) throw new CrmError("Deal not found.");
  if (deal.stage === stage) return deal;
  const now = nowIso();
  const updated = (await db().crmDeals.update(orgId, dealId, { stage, probability: STAGE_BY_KEY[stage].probability, stage_changed_at: now, updated_at: now, status: "OPEN", lost_reason: null }))!;
  await logStageChange(orgId, userId, updated, deal.stage);
  // A deal reaching a won stage makes its contact a customer.
  if (STAGE_BY_KEY[stage].won && updated.contact_id) await db().crmContacts.update(orgId, updated.contact_id, { lead_status: "CUSTOMER", updated_at: now });
  return updated;
}

export async function setDealLost(orgId: string, userId: string, dealId: string, lost: boolean, reason: string | null): Promise<CrmDeal> {
  const deal = await db().crmDeals.get(orgId, dealId);
  if (!deal) throw new CrmError("Deal not found.");
  const updated = (await db().crmDeals.update(orgId, dealId, { status: lost ? "LOST" : "OPEN", lost_reason: lost ? reason?.slice(0, 300) || null : null, updated_at: nowIso() }))!;
  await logActivity(orgId, userId, { kind: "STAGE_CHANGE", subject: lost ? `Marked as lost${reason ? `: ${reason.slice(0, 120)}` : ""}` : "Reopened", deal_id: dealId, contact_id: deal.contact_id });
  return updated;
}

export async function deleteDeal(orgId: string, dealId: string): Promise<boolean> {
  const d = db();
  const activities = await d.crmActivities.list(orgId, { where: { deal_id: dealId } });
  await Promise.all(activities.map((a) => d.crmActivities.remove(orgId, a.id)));
  return d.crmDeals.remove(orgId, dealId);
}

async function logStageChange(orgId: string, userId: string, deal: CrmDeal, from: CrmStage) {
  await logActivity(orgId, userId, { kind: "STAGE_CHANGE", subject: `${STAGE_BY_KEY[from].label} → ${STAGE_BY_KEY[deal.stage].label}`, deal_id: deal.id, contact_id: deal.contact_id });
}

/* -------------------------------- activities ------------------------------- */

export async function logActivity(
  orgId: string,
  userId: string | null,
  a: { kind: CrmActivity["kind"]; subject: string; details?: string | null; due_at?: string | null; contact_id?: string | null; deal_id?: string | null },
): Promise<CrmActivity> {
  const now = nowIso();
  const row: CrmActivity = {
    id: newId(),
    organization_id: orgId,
    kind: a.kind,
    subject: a.subject.slice(0, 200),
    details: a.details ?? null,
    due_at: a.due_at ?? null,
    done: a.kind === "NOTE" || a.kind === "STAGE_CHANGE" || a.kind === "EMAIL",
    contact_id: a.contact_id ?? null,
    deal_id: a.deal_id ?? null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  return db().crmActivities.insert(row);
}

export async function addActivity(orgId: string, userId: string, input: z.infer<typeof ActivityInput>): Promise<CrmActivity> {
  await Promise.all([assertContact(orgId, input.contact_id), assertDeal(orgId, input.deal_id)]);
  if (!input.contact_id && !input.deal_id) throw new CrmError("An activity belongs to a contact or a deal.");
  // An activity on a deal also shows on the deal's contact.
  const contactId = input.contact_id ?? (input.deal_id ? (await db().crmDeals.get(orgId, input.deal_id))?.contact_id ?? null : null);
  return logActivity(orgId, userId, { ...input, contact_id: contactId });
}

/* --------------------------------- reporting -------------------------------- */

export { summarizePipeline, type PipelineSummary, type StageSummary } from "@/lib/crm-summary";

/** Free-text contact search over name, email, company, phone and tags. Pure. */
export function matchesContact(c: CrmContact, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [c.first_name, c.last_name, c.email, c.company, c.phone, c.mobile, c.title, c.city, c.country, ...c.tags].filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}
