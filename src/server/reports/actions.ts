"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/server/organizations/service";
import { canDeleteReport } from "@/server/auth/permissions";
import { db } from "@/server/db/store";
import { audit } from "@/server/audit";

const Delete = z.object({ id: z.string().min(1).max(64), from: z.enum(["list", "detail"]).default("list") });

/**
 * Permanently deletes a report from the organization's record. Linked records
 * (sessions, decisions, Studio work, memory) are kept; memory that cites the
 * report keeps its provenance id for traceability.
 */
export async function deleteReportAction(fd: FormData): Promise<void> {
  const ctx = await requireContext();
  const p = Delete.safeParse({ id: fd.get("id"), from: fd.get("from") ?? undefined });
  if (!p.success) return;
  const orgId = ctx.organization.id;
  const report = await db().reports.get(orgId, p.data.id);
  if (!report) redirect("/reports");
  if (!canDeleteReport(ctx.role, ctx.user.id, report)) redirect(`/reports/${report.id}?error=forbidden`);
  await db().reports.remove(orgId, report.id);
  await audit(orgId, ctx.user.id, "report.delete", "report", report.id, { title: report.title, report_type: report.report_type, version: report.version });
  revalidatePath("/reports");
  revalidatePath("/hq");
  redirect(`/reports?deleted=${encodeURIComponent(report.title.slice(0, 80))}`);
}
