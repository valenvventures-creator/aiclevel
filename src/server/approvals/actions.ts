"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/store";
import { authorize } from "@/server/organizations/service";
import { audit } from "@/server/audit";

/**
 * HUMAN APPROVAL LAYER: A.I. Executive proposes → human reviews → human
 * approves → system executes. Execution adapters for external actions
 * (email, publishing, sharing) are invoked only after APPROVED and only when
 * the corresponding integration is connected; until then an approved request
 * is recorded as approved-not-executed.
 */
export async function reviewApprovalAction(fd: FormData) {
  const ctx = await authorize("approvals.review");
  const id = String(fd.get("id") ?? "");
  const decision = fd.get("decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  const req = await db().approvals.get(ctx.organization.id, id);
  if (!req || req.status !== "PENDING") return;
  await db().approvals.update(ctx.organization.id, id, { status: decision, reviewed_by: ctx.user.id });
  await audit(ctx.organization.id, ctx.user.id, "approval.action", "approval_request", id, { decision, action_type: req.action_type });
  revalidatePath("/hq");
}
