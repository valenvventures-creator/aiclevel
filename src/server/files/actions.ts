"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { audit } from "@/server/audit";
import { deleteFile } from "./service";

export async function deleteFileAction(fd: FormData) {
  const ctx = await authorize("files.delete");
  const id = String(fd.get("id"));
  const rec = await db().files.get(ctx.organization.id, id);
  if (!rec) return;
  await deleteFile(rec);
  await audit(ctx.organization.id, ctx.user.id, "file.delete", "file", id, { filename: rec.filename });
  revalidatePath("/files");
}
