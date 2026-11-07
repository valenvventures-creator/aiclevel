import "server-only";
import { db } from "@/server/db/store";
import { PLATFORM_TEMPLATES } from "./templates";

export interface ResolvedTemplate {
  key: string;
  version: number;
  content: string;
  /** e.g. "cfo_core_v1" — recorded on every generated output. */
  versionTag: string;
}

/**
 * Versioned Prompt Registry. Resolution order:
 *   1. the organization's latest PUBLISHED override in `prompt_templates`
 *   2. the platform default in templates.ts
 * Partials ({{>key}}) are expanded recursively (depth-limited).
 */
export const PromptRegistry = {
  platform(key: string): ResolvedTemplate {
    const t = PLATFORM_TEMPLATES.find((x) => x.key === key);
    if (!t) throw new Error(`Unknown prompt template: ${key}`);
    return { key, version: t.version, content: expandPartials(t.content, 0), versionTag: `${key}_v${t.version}` };
  },

  async resolve(orgId: string, key: string): Promise<ResolvedTemplate> {
    try {
      const rows = await db().promptTemplates.list(orgId, { where: { key, status: "PUBLISHED" }, orderBy: "version", desc: true, limit: 1 });
      if (rows[0]) return { key, version: rows[0].version, content: expandPartials(rows[0].content, 0), versionTag: `${key}_v${rows[0].version}` };
    } catch (err) {
      console.error("[prompts] override lookup failed; using platform default", key, err);
    }
    return this.platform(key);
  },

  list() {
    return PLATFORM_TEMPLATES.map((t) => ({ key: t.key, version: t.version, type: t.type }));
  },
};

function expandPartials(content: string, depth: number): string {
  if (depth > 3) return content;
  return content.replace(/\{\{>([a-z_]+)\}\}/g, (_, k: string) => {
    const t = PLATFORM_TEMPLATES.find((x) => x.key === k);
    return t ? expandPartials(t.content, depth + 1) : "";
  });
}

export function fill(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}
