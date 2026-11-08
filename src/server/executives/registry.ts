import "server-only";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import type { AIExecutive, AIExecutiveModelConfig, AIExecutivePersona, ExecutiveRoleCode, ResolvedExecutive } from "@/types/domain";

/**
 * AIExecutiveRegistry — the ONLY way product surfaces load executive
 * definitions. Configuration is database-driven per organization; nothing
 * about an executive's behaviour is hardcoded in UI components.
 */
export const AIExecutiveRegistry = {
  async getAllExecutives(orgId: string, opts: { includeInactive?: boolean } = {}): Promise<AIExecutive[]> {
    const all = await db().executives.list(orgId, { orderBy: "sort_order" });
    return opts.includeInactive ? all : all.filter((e) => e.is_active);
  },

  async getExecutive(orgId: string, idOrSlug: string): Promise<AIExecutive | null> {
    const d = db();
    const byId = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? await d.executives.get(orgId, idOrSlug) : null;
    if (byId) return byId;
    const [bySlug] = await d.executives.list(orgId, { where: { slug: idOrSlug }, limit: 1 });
    return bySlug ?? null;
  },

  async getByRole(orgId: string, role: ExecutiveRoleCode): Promise<AIExecutive | null> {
    const [e] = await db().executives.list(orgId, { where: { role_code: role }, limit: 1 });
    return e ?? null;
  },

  async getExecutivePersona(orgId: string, executiveId: string): Promise<AIExecutivePersona | null> {
    const [p] = await db().personas.list(orgId, { where: { executive_id: executiveId }, limit: 1 });
    return p ?? null;
  },

  async getExecutiveSkills(orgId: string, executiveId: string) {
    return db().skills.list(orgId, { where: { executive_id: executiveId }, orderBy: "priority" });
  },

  async getExecutiveModelConfig(orgId: string, executiveId: string): Promise<AIExecutiveModelConfig | null> {
    const [m] = await db().modelConfigs.list(orgId, { where: { executive_id: executiveId }, limit: 1 });
    return m ?? null;
  },

  async getExecutiveTools(orgId: string, executiveId: string): Promise<string[]> {
    return (await this.getExecutiveModelConfig(orgId, executiveId))?.tool_permissions ?? [];
  },

  async getExecutiveMemoryPermissions(orgId: string, executiveId: string) {
    return (await this.getExecutiveModelConfig(orgId, executiveId))?.memory_categories ?? [];
  },

  async getExecutivePromptVersion(orgId: string, executiveId: string): Promise<string> {
    return (await this.getExecutiveModelConfig(orgId, executiveId))?.prompt_key ?? "executive_generic";
  },

  /** Fully-resolved executive, used by the AI Gateway and orchestrator. */
  async resolve(orgId: string, idOrSlug: string): Promise<ResolvedExecutive | null> {
    const exec = await this.getExecutive(orgId, idOrSlug);
    if (!exec) return null;
    const d = db();
    const [persona, skills, model, voices] = await Promise.all([
      this.getExecutivePersona(orgId, exec.id),
      this.getExecutiveSkills(orgId, exec.id),
      this.getExecutiveModelConfig(orgId, exec.id),
      d.voices.list(orgId, { where: { executive_id: exec.id }, limit: 1 }),
    ]);
    if (!persona || !model) return null;
    return { ...exec, persona, skills, model, voice: voices[0] ?? null };
  },

  async resolveMany(orgId: string, ids: string[]): Promise<ResolvedExecutive[]> {
    const out = await Promise.all(ids.map((id) => this.resolve(orgId, id)));
    return out.filter((e): e is ResolvedExecutive => Boolean(e)).sort((a, b) => a.sort_order - b.sort_order);
  },

  async updateExecutive(orgId: string, actorId: string, executiveId: string, patch: { executive?: Partial<AIExecutive>; persona?: Partial<AIExecutivePersona>; model?: Partial<AIExecutiveModelConfig> }) {
    const d = db();
    if (patch.executive) await d.executives.update(orgId, executiveId, { ...patch.executive, updated_at: nowIso() });
    if (patch.persona) {
      const p = await this.getExecutivePersona(orgId, executiveId);
      if (p) await d.personas.update(orgId, p.id, patch.persona);
    }
    if (patch.model) {
      const m = await this.getExecutiveModelConfig(orgId, executiveId);
      if (m) await d.modelConfigs.update(orgId, m.id, patch.model);
    }
    await audit(orgId, actorId, "executive.config_change", "ai_executive", executiveId, { fields: Object.keys({ ...patch.executive, ...patch.persona, ...patch.model }) });
  },

  /** Replaces an executive's listed skills (shown in its profile and given to the model as its expertise). */
  async replaceSkills(orgId: string, actorId: string, executiveId: string, skills: { name: string; description: string }[]) {
    const d = db();
    const current = await d.skills.list(orgId, { where: { executive_id: executiveId } });
    await Promise.all(current.map((s) => d.skills.remove(orgId, s.id)));
    if (skills.length) await d.skills.insertMany(skills.map((s, i) => ({ id: newId(), organization_id: orgId, executive_id: executiveId, name: s.name, description: s.description, priority: i + 1 })));
    await audit(orgId, actorId, "executive.config_change", "ai_executive", executiveId, { fields: ["skills"] });
  },

  async activateExecutive(orgId: string, actorId: string, executiveId: string) {
    await this.updateExecutive(orgId, actorId, executiveId, { executive: { is_active: true } });
  },
  async deactivateExecutive(orgId: string, actorId: string, executiveId: string) {
    const e = await this.getExecutive(orgId, executiveId);
    if (e?.is_core) throw new Error("Core C-Level executives cannot be deactivated.");
    await this.updateExecutive(orgId, actorId, executiveId, { executive: { is_active: false } });
  },
};
