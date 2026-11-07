import "server-only";
import { db } from "@/server/db/store";
import { rankMemories, type RetrievalQuery, type ScoredMemory } from "./retrieval";

/**
 * Memory retrieval entry point. Demo mode ranks in-process; Supabase mode
 * should call the `match_memory_records` RPC (pgvector) to pre-filter
 * candidates, then apply the same ranking. Candidates are capped so the
 * full organizational memory is never loaded into a model context.
 */
export async function retrieveMemory(q: RetrievalQuery): Promise<ScoredMemory[]> {
  const candidates = await db().memory.list(q.organizationId, { orderBy: "updated_at", desc: true, limit: 500 });
  return rankMemories(candidates, q);
}
