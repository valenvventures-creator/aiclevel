import "server-only";
import { EXECUTIVE_SEEDS } from "@/config/executives/defaults";
import { db, newId, nowIso } from "@/server/db/store";
import type { AIExecutive } from "@/types/domain";

/** Copies the seven default executive definitions into a tenant. Idempotent. */
export async function seedExecutivesForOrganization(organizationId: string): Promise<AIExecutive[]> {
  const d = db();
  const existing = await d.executives.list(organizationId);
  if (existing.length) return existing;
  const now = nowIso();
  const created: AIExecutive[] = [];
  for (const s of EXECUTIVE_SEEDS) {
    const id = newId();
    const exec: AIExecutive = {
      id,
      organization_id: organizationId,
      role_code: s.role_code,
      slug: s.slug,
      title: s.title,
      short_title: s.short_title,
      display_name: null,
      functional_mandate: s.functional_mandate,
      description: s.description,
      avatar_url: s.avatar_url,
      accent: s.accent,
      status: "AVAILABLE",
      is_core: true,
      is_active: true,
      sort_order: s.sort_order,
      created_at: now,
      updated_at: now,
    };
    await d.executives.insert(exec);
    await d.personas.insert({ id: newId(), organization_id: organizationId, executive_id: id, ...s.persona });
    await d.modelConfigs.insert({ id: newId(), organization_id: organizationId, executive_id: id, ...s.model });
    await d.skills.insertMany(s.skills.map((k, i) => ({ id: newId(), organization_id: organizationId, executive_id: id, name: k.name, description: k.description, priority: i + 1 })));
    await d.voices.insert({ id: newId(), organization_id: organizationId, executive_id: id, provider: "browser", voice_id: "default", voice_name: `${s.short_title} — Default`, settings_json: { playback_speed: 1 } });
    created.push(exec);
  }
  return created;
}
