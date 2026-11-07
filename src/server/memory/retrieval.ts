import type { ExecutiveRoleCode, MemoryCategory, MemoryRecord, MemoryStatus, Role } from "@/types/domain";
import { cosine, lexicalEmbedding } from "./embeddings";

/**
 * C-Suite Memory retrieval scoring. Combines semantic similarity, recency,
 * importance, category permissions, executive relevance, project relevance,
 * verification status, visibility and organization ownership.
 * NEVER returns the whole memory — only the top-k relevant records.
 */
export interface RetrievalQuery {
  organizationId: string;
  query: string;
  executiveRole?: ExecutiveRoleCode;
  allowedCategories?: MemoryCategory[] | "ALL";
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

/**
 * Decisions a person approved (or confirmed) are organization-wide knowledge:
 * every executive may recall them, whatever memory categories their role
 * normally searches. Unverified (PROPOSED) decision records stay scoped.
 */
export function isSharedDecision(r: Pick<MemoryRecord, "category" | "status">): boolean {
  return r.category === "DECISIONS" && (r.status === "VERIFIED" || r.status === "USER_CONFIRMED");
}

export function rankMemories(records: MemoryRecord[], q: RetrievalQuery): ScoredMemory[] {
  const qv = lexicalEmbedding(q.query);
  const now = (q.now ?? new Date()).getTime();
  const out: ScoredMemory[] = [];
  for (const r of records) {
    if (r.organization_id !== q.organizationId) continue; // tenant isolation, defence in depth
    if (r.status === "ARCHIVED") continue;
    if (!canView(r, q.viewerRole)) continue;
    if (q.allowedCategories && q.allowedCategories !== "ALL" && !q.allowedCategories.includes(r.category) && !isSharedDecision(r)) continue;

    const vec = r.embedding && r.embedding.length === qv.length ? r.embedding : lexicalEmbedding(`${r.title} ${r.content}`);
    const similarity = cosine(qv, vec);
    const ageDays = Math.max(0, (now - new Date(r.updated_at).getTime()) / 86_400_000);
    const recency = Math.exp(-ageDays / 120);
    const importance = r.importance / 5;
    const execBoost = q.executiveRole && r.executive_relevance.includes(q.executiveRole) ? 0.12 : 0;
    const projectBoost = q.projectId && r.project_id === q.projectId ? 0.15 : 0;
    const pinBoost = r.pinned ? 0.1 : 0;

    const score = (0.55 * similarity + 0.15 * recency + 0.15 * importance + execBoost + projectBoost + pinBoost) * STATUS_WEIGHT[r.status];
    if (similarity > 0.05 || r.pinned) out.push({ record: r, score, similarity });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, q.limit ?? 8);
}
