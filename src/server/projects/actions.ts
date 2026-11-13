"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { ProjectError, ProjectInput, createProject, updateProject } from "./service";

export type ProjectFormState = { error?: string; message?: string; values?: Record<string, string> };

const formObject = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};

const message = (e: unknown) =>
  e instanceof z.ZodError ? (e.issues[0]?.message ?? "Check the form.") : e instanceof ProjectError ? e.message : "Something went wrong. Please try again.";

export async function createProjectAction(_: ProjectFormState, fd: FormData): Promise<ProjectFormState> {
  let id: string;
  try {
    const ctx = await authorize("projects.manage");
    const p = await createProject(ctx.organization.id, ctx.user.id, ProjectInput.parse(formObject(fd)));
    id = p.id;
  } catch (e) {
    if (!(e instanceof z.ZodError || e instanceof ProjectError)) console.error("[projects] create failed", e);
    return { error: message(e), values: formObject(fd) };
  }
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(_: ProjectFormState, fd: FormData): Promise<ProjectFormState> {
  try {
    const ctx = await authorize("projects.manage");
    const id = String(fd.get("id"));
    await updateProject(ctx.organization.id, id, ProjectInput.parse(formObject(fd)));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { message: "Project saved." };
  } catch (e) {
    if (!(e instanceof z.ZodError || e instanceof ProjectError)) console.error("[projects] update failed", e);
    return { error: message(e), values: formObject(fd) };
  }
}
