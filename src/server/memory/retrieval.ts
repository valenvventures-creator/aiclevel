import type { ExecutiveRoleCode, MemoryCategory, MemoryRecord, MemoryStatus, Role } from "@/types/domain";
import { cosine, lexicalEmbedding } from "./embeddings";

/**
 * C-Level Memory retrieval scoring. Combines semantic similarity, recency,
 * importance, the executive's focus areas, executive relevance, project
 * relevance, verification status, the asking person's visibility and
 * organization ownership. Every executive may draw on all of C-Level Memory.
 * NEVER returns the whole memory — only the top-k relevant records.
 */
export interface RetrievalQuery {
  organizationId: string;
  query: string;
  executiveRole?: ExecutiveRoleCode;
  /**
   * The executive's focus areas. All seven executives may draw on all of
   * C-Level Memory (shared intelligence); entries in an executive's focus areas
   * are ranked higher for it. "ALL" (or absent) means no particular focus.
   */
  focusCategories?: MemoryCategory[] | "ALL";
  projectId?: string | null;
  viewerRole: Role;
  limit?: number;
  now?: Date;
}

const STATUS_WEIGHT: Record<MemoryStatus, number> = {
  VERIFIED: 1,
  USER_CONFIRMED: 0.95,
  SYSTEM_IMPORTED: 0.8,
  PROPOSED: 0.55,
  ARCHIVED: 0,
};

export function canView(record: MemoryRecord, viewerRole: Role): boolean {
  if (record.visibility === "ORGANIZATION") return true;
  if (record.visibility === "LEADERSHIP") return ["OWNER", "ADMIN", "EXECUTIVE"].includes(viewerRole);
  return viewerRole === "OWNER";
}

export interface ScoredMemory {
  record: MemoryRecord;
  score: number;
  similarity: number;
}

export function rankMemories(records: MemoryRecord[], q: RetrievalQuery): ScoredMemory[] {
  const qv = lexicalEmbedding(q.query);
  const now = (q.now ?? new Date()).getTime();
  const out: ScoredMemory[] = [];
  for (const r of records) {
    if (r.organization_id !== q.organizationId) continue; // tenant isolation, defence in depth
    if (r.status === "ARCHIVED") continue;
    if (!canView(r, q.viewerRole)) continue;

    const vec = r.embedding && r.embedding.length === qv.length ? r.embedding : lexicalEmbedding(`${r.title} ${r.content}`);
    const similarity = cosine(qv, vec);
    const ageDays = Math.max(0, (now - new Date(r.updated_at).getTime()) / 86_400_000);
    const recency = Math.exp(-ageDays / 120);
    const importance = r.importance / 5;
    const execBoost = q.executiveRole && r.executive_relevance.includes(q.executiveRole) ? 0.12 : 0;
    const focusBoost = Array.isArray(q.focusCategories) && q.focusCategories.includes(r.category) ? 0.1 : 0;
    const projectBoost = q.projectId && r.project_id === q.projectId ? 0.15 : 0;
    const pinBoost = r.pinned ? 0.1 : 0;

    const score = (0.55 * similarity + 0.15 * recency + 0.15 * importance + execBoost + focusBoost + projectBoost + pinBoost) * STATUS_WEIGHT[r.status];
    if (similarity > 0.05 || r.pinned) out.push({ record: r, score, similarity });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, q.limit ?? 8);
}
