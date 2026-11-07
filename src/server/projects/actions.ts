"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { db, newId, nowIso } from "@/server/db/store";

const P = z.object({ name: z.string().trim().min(2, "Name the project.").max(120), description: z.string().trim().max(2000).default("") });

export async function createProjectAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const ctx = await authorize("projects.manage");
  const p = P.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const id = newId();
  await db().projects.insert({ id, organization_id: ctx.organization.id, name: p.data.name, description: p.data.description, status: "ACTIVE", owner_id: ctx.user.id, created_at: nowIso() });
  redirect(`/projects/${id}`);
}
