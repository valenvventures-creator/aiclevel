import "server-only";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { lexicalEmbedding } from "@/server/memory/embeddings";
import type { Decision } from "@/types/domain";

/**
 * An approved decision becomes verified C-Suite Memory, so the executives
 * remember it in later sessions. A person approved it, so it is VERIFIED
 * (not an A.I. conclusion); provenance points back to the decision.
 */
export async function rememberApprovedDecision(decision: Decision, userId: string) {
  const orgId = decision.organization_id;
  const chosen = decision.chosen_option ? decision.options_json.find((o) => o.id === decision.chosen_option) : null;
  const title = `Decision: ${decision.title}`;
  const content = [
    `Question: ${decision.question}`,
    chosen ? `Chosen option: ${chosen.id} — ${chosen.label}` : "",
    decision.recommended_option && decision.recommended_option !== decision.chosen_option ? `The CEO had recommended option ${decision.recommended_option}.` : "",
    `Decision: ${decision.recommendation}`,
    decision.rationale ? `Rationale: ${decision.rationale}` : "",
    `Approved ${nowIso().slice(0, 10)}.`,
  ].filter(Boolean).join("\n");
  const now = nowIso();
  const [existing] = await db().memory.list(orgId, { where: { source_id: decision.id }, limit: 1 });
  if (existing) {
    await db().memory.update(orgId, existing.id, { title, content, status: "VERIFIED", verified_by: userId, embedding: lexicalEmbedding(`${title} ${content}`), updated_at: now });
    return;
  }
  const memoryId = newId();
  await db().memory.insert({
    id: memoryId, organization_id: orgId, project_id: decision.project_id, title, content, category: "DECISIONS", importance: 4, status: "VERIFIED", pinned: false,
    source_type: decision.session_id ? "CSUITE_SESSION" : "HUMAN_ENTRY", source_id: decision.id, created_by: userId, verified_by: userId, confidence: 1,
    embedding: lexicalEmbedding(`${title} ${content}`), visibility: "ORGANIZATION", executive_relevance: [], created_at: now, updated_at: now,
  });
  await audit(orgId, userId, "memory.create", "memory_record", memoryId, { source: "decision", decision_id: decision.id });
}
