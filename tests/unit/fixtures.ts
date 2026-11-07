import { EXECUTIVE_SEEDS } from "@/config/executives/defaults";
import type { MemoryRecord, ResolvedExecutive } from "@/types/domain";

export function resolvedExec(role: string, orgId = "org-a"): ResolvedExecutive {
  const s = EXECUTIVE_SEEDS.find((x) => x.role_code === role)!;
  const id = `exec-${role}`;
  return {
    id, organization_id: orgId, role_code: s.role_code, slug: s.slug, title: s.title, short_title: s.short_title, display_name: null,
    functional_mandate: s.functional_mandate, description: s.description, avatar_url: null, accent: s.accent, status: "AVAILABLE", is_core: true,
    is_active: true, sort_order: s.sort_order, created_at: "", updated_at: "",
    persona: { id: `p-${role}`, organization_id: orgId, executive_id: id, ...s.persona },
    skills: s.skills.map((k, i) => ({ id: `s-${role}-${i}`, organization_id: orgId, executive_id: id, priority: i, ...k })),
    model: { id: `m-${role}`, organization_id: orgId, executive_id: id, ...s.model },
    voice: null,
  };
}

export function memory(partial: Partial<MemoryRecord> & { title: string; content: string }): MemoryRecord {
  return {
    id: Math.random().toString(36).slice(2), organization_id: "org-a", project_id: null, category: "COMPANY", importance: 3, status: "VERIFIED",
    pinned: false, source_type: "HUMAN_ENTRY", source_id: null, created_by: "u", verified_by: null, confidence: 0.9, embedding: null,
    visibility: "ORGANIZATION", executive_relevance: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...partial,
  };
}
