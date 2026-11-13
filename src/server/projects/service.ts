import "server-only";
import { z } from "zod";
import { db, newId, nowIso } from "@/server/db/store";
import type { Project } from "@/types/domain";

/**
 * Projects: workspaces that group intelligence around an initiative, with an
 * optional location (pin on the Projects map) and cover image.
 */
const coord = (min: number, max: number, label: string) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}.` });
        return z.NEVER;
      }
      return Math.round(n * 1e6) / 1e6;
    });

export const ProjectInput = z
  .object({
    name: z.string({ error: "Name the project." }).trim().min(2, "Name the project.").max(120),
    description: z.string().trim().max(2000).default(""),
    status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
    location_label: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)),
    latitude: coord(-90, 90, "Latitude"),
    longitude: coord(-180, 180, "Longitude"),
    image_file_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  })
  .refine((p) => (p.latitude === null) === (p.longitude === null), { message: "Choose a place on the map, or clear the location.", path: ["location_label"] });
export type ProjectInputT = z.infer<typeof ProjectInput>;

export class ProjectError extends Error {}

async function assertImage(orgId: string, fileId: string | null) {
  if (!fileId) return;
  const f = await db().files.get(orgId, fileId);
  if (!f || f.purpose !== "PROJECT_IMAGE") throw new ProjectError("That image is no longer available. Upload it again.");
}

export async function createProject(orgId: string, userId: string, input: ProjectInputT): Promise<Project> {
  await assertImage(orgId, input.image_file_id);
  const now = nowIso();
  const row: Project = { id: newId(), organization_id: orgId, owner_id: userId, created_at: now, updated_at: now, ...input };
  return db().projects.insert(row);
}

export async function updateProject(orgId: string, projectId: string, input: ProjectInputT): Promise<Project> {
  await assertImage(orgId, input.image_file_id);
  const updated = await db().projects.update(orgId, projectId, { ...input, updated_at: nowIso() });
  if (!updated) throw new ProjectError("Project not found.");
  return updated;
}

/** Projects with a pin, for the map. Pure. */
export function mappable<T extends Pick<Project, "latitude" | "longitude">>(projects: T[]): (T & { latitude: number; longitude: number })[] {
  return projects.filter((p): p is T & { latitude: number; longitude: number } => typeof p.latitude === "number" && typeof p.longitude === "number");
}
