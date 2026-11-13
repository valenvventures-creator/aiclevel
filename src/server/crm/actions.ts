"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { audit } from "@/server/audit";
import { db } from "@/server/db/store";
import { CRM_STAGES, type CrmDeal } from "@/types/domain";
import {
  ActivityInput,
  addActivity,
  ContactInput,
  CrmError,
  createContact,
  createDeal,
  DealInput,
  deleteContact,
  deleteDeal,
  moveDeal,
  setDealLost,
  updateContact,
  updateDeal,
} from "./service";

/**
 * CRM server actions. Reading needs "crm.read" (pages); creating, editing and
 * moving needs "crm.write"; deleting needs "crm.delete". The organization
 * always comes from authorize(), never from the browser.
 */
/** `values` echoes what was submitted after a failed save, so the form keeps the person's input. */
export type CrmFormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function failure(e: unknown): CrmFormState {
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { error: e.issues[0]?.message ?? "Check the highlighted fields.", fieldErrors };
  }
  if (e instanceof CrmError) return { error: e.message };
  console.error("[crm] action failed", e);
  return { error: "Something went wrong. Please try again." };
}

const formObject = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};

const refresh = (...paths: string[]) => {
  revalidatePath("/crm");
  revalidatePath("/crm/contacts");
  for (const p of paths) revalidatePath(p);
};

/* --------------------------------- contacts -------------------------------- */

export async function saveContactAction(_: CrmFormState, fd: FormData): Promise<CrmFormState> {
  let createdId: string | null = null;
  try {
    const ctx = await authorize("crm.write");
    const id = String(fd.get("id") ?? "");
    const input = ContactInput.parse(formObject(fd));
    if (id) {
      await updateContact(ctx.organization.id, id, input);
      await audit(ctx.organization.id, ctx.user.id, "crm.contact", "crm_contact", id, { action: "update" });
      refresh(`/crm/contacts/${id}`);
      return { ok: true, message: "Contact saved." };
    }
    const c = await createContact(ctx.organization.id, ctx.user.id, input);
    await audit(ctx.organization.id, ctx.user.id, "crm.contact", "crm_contact", c.id, { action: "create" });
    refresh();
    createdId = c.id;
  } catch (e) {
    return { ...failure(e), values: formObject(fd) };
  }
  redirect(`/crm/contacts/${createdId}`);
}

export async function deleteContactAction(fd: FormData) {
  const ctx = await authorize("crm.delete");
  const id = String(fd.get("id"));
  if (await deleteContact(ctx.organization.id, id)) await audit(ctx.organization.id, ctx.user.id, "crm.contact", "crm_contact", id, { action: "delete" });
  refresh();
  redirect("/crm/contacts");
}

/* ---------------------------------- deals ---------------------------------- */

export async function saveDealAction(_: CrmFormState, fd: FormData): Promise<CrmFormState> {
  let createdId: string | null = null;
  try {
    const ctx = await authorize("crm.write");
    const id = String(fd.get("id") ?? "");
    const input = DealInput.parse(formObject(fd));
    if (id) {
      await updateDeal(ctx.organization.id, ctx.user.id, id, input);
      await audit(ctx.organization.id, ctx.user.id, "crm.deal", "crm_deal", id, { action: "update" });
      refresh(`/crm/deals/${id}`);
      return { ok: true, message: "Deal saved." };
    }
    const deal = await createDeal(ctx.organization.id, ctx.user.id, input);
    await audit(ctx.organization.id, ctx.user.id, "crm.deal", "crm_deal", deal.id, { action: "create", stage: deal.stage });
    refresh(deal.contact_id ? `/crm/contacts/${deal.contact_id}` : "/crm");
    createdId = deal.id;
  } catch (e) {
    return { ...failure(e), values: formObject(fd) };
  }
  // Created from the board's quick form: stay on the board.
  if (fd.get("return_to") === "board") redirect("/crm");
  redirect(`/crm/deals/${createdId}`);
}

/** Drag and drop on the board. Returns the saved deal so the board can reconcile. */
export async function moveDealAction(dealId: string, stage: string): Promise<{ ok: true; deal: CrmDeal } | { ok: false; error: string }> {
  try {
    const ctx = await authorize("crm.write");
    const s = z.enum(CRM_STAGES).parse(stage);
    const deal = await moveDeal(ctx.organization.id, ctx.user.id, z.string().uuid().parse(dealId), s);
    await audit(ctx.organization.id, ctx.user.id, "crm.deal", "crm_deal", deal.id, { action: "move", stage: s });
    refresh(`/crm/deals/${deal.id}`);
    return { ok: true, deal };
  } catch (e) {
    return { ok: false, error: failure(e).error ?? "The deal could not be moved." };
  }
}

export async function setDealLostAction(fd: FormData) {
  const ctx = await authorize("crm.write");
  const id = String(fd.get("id"));
  const lost = fd.get("lost") === "1";
  await setDealLost(ctx.organization.id, ctx.user.id, id, lost, String(fd.get("reason") ?? "").trim() || null);
  await audit(ctx.organization.id, ctx.user.id, "crm.deal", "crm_deal", id, { action: lost ? "lost" : "reopen" });
  refresh(`/crm/deals/${id}`);
}

export async function deleteDealAction(fd: FormData) {
  const ctx = await authorize("crm.delete");
  const id = String(fd.get("id"));
  if (await deleteDeal(ctx.organization.id, id)) await audit(ctx.organization.id, ctx.user.id, "crm.deal", "crm_deal", id, { action: "delete" });
  refresh();
  redirect("/crm");
}

/* -------------------------------- activities ------------------------------- */

export async function addActivityAction(_: CrmFormState, fd: FormData): Promise<CrmFormState> {
  try {
    const ctx = await authorize("crm.write");
    const raw = formObject(fd);
    // "2026-11-20T15:00" from a datetime-local field is the person's local time.
    if (raw.due_at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw.due_at)) {
      const offset = Number(raw.tz_offset) || 0;
      raw.due_at = new Date(Date.parse(`${raw.due_at}:00Z`) + offset * 60_000).toISOString();
    }
    const a = await addActivity(ctx.organization.id, ctx.user.id, ActivityInput.parse(raw));
    await audit(ctx.organization.id, ctx.user.id, "crm.activity", "crm_activity", a.id, { action: "create", kind: a.kind });
    refresh(a.contact_id ? `/crm/contacts/${a.contact_id}` : "/crm", a.deal_id ? `/crm/deals/${a.deal_id}` : "/crm");
    return { ok: true, message: "Activity added." };
  } catch (e) {
    return { ...failure(e), values: formObject(fd) };
  }
}

export async function toggleActivityAction(fd: FormData) {
  const ctx = await authorize("crm.write");
  const a = await db().crmActivities.get(ctx.organization.id, String(fd.get("id")));
  if (!a || a.kind === "STAGE_CHANGE") return;
  await db().crmActivities.update(ctx.organization.id, a.id, { done: !a.done, updated_at: new Date().toISOString() });
  refresh(a.contact_id ? `/crm/contacts/${a.contact_id}` : "/crm", a.deal_id ? `/crm/deals/${a.deal_id}` : "/crm");
}

export async function deleteActivityAction(fd: FormData) {
  const ctx = await authorize("crm.write");
  const a = await db().crmActivities.get(ctx.organization.id, String(fd.get("id")));
  if (!a || a.kind === "STAGE_CHANGE") return;
  // Anyone may remove their own activity; removing someone else's needs "crm.delete".
  if (a.created_by !== ctx.user.id) await authorize("crm.delete");
  await db().crmActivities.remove(ctx.organization.id, a.id);
  await audit(ctx.organization.id, ctx.user.id, "crm.activity", "crm_activity", a.id, { action: "delete" });
  refresh(a.contact_id ? `/crm/contacts/${a.contact_id}` : "/crm", a.deal_id ? `/crm/deals/${a.deal_id}` : "/crm");
}
