import "server-only";
import { dataMode } from "@/lib/env";
import { db } from "@/server/db/store";
import type { AIExecutivePersona, Organization } from "@/types/domain";

/**
 * One-time upgrade of product wording saved before the "C-Suite" → "C-Level"
 * rename. Only text the platform wrote is touched: the seeded executive
 * definitions, the "Session Minutes" report type and, for the demo
 * organization, its seeded sample content. What customers wrote is left alone.
 *
 * It also moves executive portraits off the retired thoughtauthorities.com
 * host to the copies served with the app (/brand/executives).
 *
 * Supabase deployments get the same changes from migrations 010 and 011; this
 * covers demo mode, whose data lives outside Postgres.
 */
export const LEGACY_MINUTES_TYPE = "C-Suite Session Minutes";

const upgraded = new Set<string>();

export const LEGACY_AVATAR_BASE = "https://thoughtauthorities.com/assets/avatars/";

/** Portraits once hosted on thoughtauthorities.com now ship with the app. */
export function relocateAvatar(url: string | null): string | null {
  return url?.startsWith(LEGACY_AVATAR_BASE) ? `/brand/executives/${url.slice(LEGACY_AVATAR_BASE.length)}` : url;
}

export function renameLabel(text: string): string {
  return text.replace(/C-Suite/g, "C-Level").replace(/C-SUITE/g, "C-LEVEL");
}

/** Patch holding only the given fields whose text changes, or null. */
function changed<T extends object>(row: T, keys: readonly (keyof T)[]): Partial<T> | null {
  const patch: Partial<T> = {};
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && renameLabel(v) !== v) patch[k] = renameLabel(v) as T[keyof T];
  }
  return Object.keys(patch).length ? patch : null;
}

const PERSONA_TEXT = [
  "north_star", "core_belief", "leadership_promise", "biography", "personality", "communication_style",
  "decision_style", "primary_question", "system_instructions", "reasoning_guidelines", "output_preferences", "risk_constraints",
] as const satisfies readonly (keyof AIExecutivePersona)[];

export async function upgradeStoredLabels(org: Pick<Organization, "id" | "is_demo">): Promise<void> {
  const orgId = org.id;
  if (dataMode() !== "demo" || upgraded.has(orgId)) return;
  upgraded.add(orgId);
  try {
    const d = db();
    const executives = await d.executives.list(orgId);
    const core = executives.filter((e) => e.is_core);
    for (const e of executives) {
      const patch = { ...(e.is_core ? changed(e, ["description", "functional_mandate"]) : null) };
      const avatar = relocateAvatar(e.avatar_url);
      if (avatar !== e.avatar_url) patch.avatar_url = avatar;
      if (Object.keys(patch).length) await d.executives.update(orgId, e.id, patch);
    }
    const coreIds = new Set(core.map((e) => e.id));
    for (const p of await d.personas.list(orgId)) {
      if (!coreIds.has(p.executive_id)) continue;
      const patch = changed(p, PERSONA_TEXT);
      if (patch) await d.personas.update(orgId, p.id, patch);
    }
    for (const r of await d.reports.list(orgId)) {
      const own = org.is_demo ? changed(r, ["title", "summary", "content"]) : null;
      const type = (r.report_type as string) === LEGACY_MINUTES_TYPE ? { report_type: "C-Level Session Minutes" as const } : null;
      if (own || type) await d.reports.update(orgId, r.id, { ...own, ...type });
    }
    if (org.is_demo) {
      for (const m of await d.memory.list(orgId)) {
        const patch = changed(m, ["title", "content"]);
        if (patch) await d.memory.update(orgId, m.id, patch);
      }
      for (const c of await d.constitutions.list(orgId)) {
        const patch = changed(c, ["mission", "decision_principles"]);
        if (patch) await d.constitutions.update(orgId, c.id, patch);
      }
    }
  } catch (err) {
    upgraded.delete(orgId); // try again on a later request
    console.error("[stored-labels] upgrade failed", orgId, err instanceof Error ? err.message : err);
  }
}
