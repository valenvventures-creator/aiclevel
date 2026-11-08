import "server-only";
import { STARTER_LIBRARY } from "@/config/executives/library";
import { db, newId, nowIso } from "@/server/db/store";
import { cosine, lexicalEmbedding } from "@/server/memory/embeddings";
import type { AIExecutive, ExecutiveLibraryItem } from "@/types/domain";

/**
 * EXECUTIVE LIBRARY — reference knowledge per executive.
 * Starter frameworks are copied in on first read (and any newly shipped
 * starter is added later); starters can be turned off but not deleted, so a
 * removed starter never comes back. Organizations add their own playbooks,
 * references and documents. Only the few items most relevant to a question
 * reach the model, within a character budget.
 */
export const LIBRARY_LIMITS = { PER_ANSWER: 4, CHAR_BUDGET: 7000, ITEM_CHARS: 20000, DOCUMENT_CHARS: 20000 } as const;

const embed = (title: string, content: string) => lexicalEmbedding(`${title} ${title} ${content.slice(0, 4000)}`);

/** Adds any starter items this executive does not have yet. Idempotent. */
export async function ensureStarterLibrary(orgId: string, exec: Pick<AIExecutive, "id" | "role_code">): Promise<void> {
  const starters = STARTER_LIBRARY[exec.role_code] ?? [];
  if (!starters.length) return;
  const existing = await db().library.list(orgId, { where: { executive_id: exec.id } });
  const have = new Set(existing.map((i) => i.starter_key).filter(Boolean));
  const missing = starters.filter((s) => !have.has(s.key));
  if (!missing.length) return;
  const now = nowIso();
  await db().library.insertMany(
    missing.map((s) => ({
      id: newId(), organization_id: orgId, executive_id: exec.id, kind: s.kind, title: s.title, content: s.content, file_id: null,
      origin: "STARTER" as const, starter_key: s.key, enabled: true, embedding: embed(s.title, s.content), created_by: null, created_at: now, updated_at: now,
    })),
  );
}

export async function listLibrary(orgId: string, exec: Pick<AIExecutive, "id" | "role_code">): Promise<ExecutiveLibraryItem[]> {
  await ensureStarterLibrary(orgId, exec);
  const all = await db().library.list(orgId, { where: { executive_id: exec.id } });
  // Two first reads at once could both add starters; show each starter once.
  const seen = new Set<string>();
  const items = all.filter((i) => !i.starter_key || (!seen.has(i.starter_key) && seen.add(i.starter_key)));
  // The organization's own knowledge first, then starters; newest first within each.
  return items.sort((a, b) => (a.origin === b.origin ? b.updated_at.localeCompare(a.updated_at) : a.origin === "ORGANIZATION" ? -1 : 1));
}

/** Ranks enabled items for a question; the organization's own items get a small preference. Pure. */
export function rankLibrary(items: readonly ExecutiveLibraryItem[], query: string, limit: number = LIBRARY_LIMITS.PER_ANSWER, charBudget: number = LIBRARY_LIMITS.CHAR_BUDGET): ExecutiveLibraryItem[] {
  const qv = lexicalEmbedding(query);
  const scored = items
    .filter((i) => i.enabled)
    .map((i) => {
      const vec = i.embedding && i.embedding.length === qv.length ? i.embedding : embed(i.title, i.content);
      const similarity = cosine(qv, vec);
      return { item: i, similarity, score: similarity + (i.origin === "ORGANIZATION" ? 0.05 : 0) };
    })
    .filter((s) => s.similarity > 0.06)
    .sort((a, b) => b.score - a.score);
  const out: ExecutiveLibraryItem[] = [];
  let used = 0;
  for (const s of scored) {
    if (out.length >= limit) break;
    const size = Math.min(s.item.content.length, 3000) + s.item.title.length;
    if (used + size > charBudget && out.length) continue;
    out.push(s.item);
    used += size;
  }
  return out;
}

export async function retrieveLibrary(orgId: string, exec: Pick<AIExecutive, "id" | "role_code">, query: string): Promise<ExecutiveLibraryItem[]> {
  try {
    const items = await listLibrary(orgId, exec);
    return rankLibrary(items, query);
  } catch (err) {
    console.error("[library] retrieval failed; answering without it", err);
    return [];
  }
}

export interface LibraryInput { kind: ExecutiveLibraryItem["kind"]; title: string; content: string; fileId?: string | null }

export async function addLibraryItem(orgId: string, userId: string, executiveId: string, input: LibraryInput): Promise<ExecutiveLibraryItem> {
  const now = nowIso();
  const row: ExecutiveLibraryItem = {
    id: newId(), organization_id: orgId, executive_id: executiveId, kind: input.kind, title: input.title.trim().slice(0, 160), content: input.content.trim().slice(0, LIBRARY_LIMITS.ITEM_CHARS),
    file_id: input.fileId ?? null, origin: "ORGANIZATION", starter_key: null, enabled: true, embedding: embed(input.title, input.content), created_by: userId, created_at: now, updated_at: now,
  };
  await db().library.insert(row);
  return row;
}

export async function updateLibraryItem(orgId: string, itemId: string, patch: { title?: string; content?: string; kind?: ExecutiveLibraryItem["kind"]; enabled?: boolean }): Promise<ExecutiveLibraryItem | null> {
  const item = await db().library.get(orgId, itemId);
  if (!item) return null;
  // Starter text stays as shipped; organizations can only turn starters on or off.
  const editable = item.origin === "ORGANIZATION";
  const title = editable && patch.title !== undefined ? patch.title.trim().slice(0, 160) : item.title;
  const content = editable && patch.content !== undefined ? patch.content.trim().slice(0, LIBRARY_LIMITS.ITEM_CHARS) : item.content;
  const next = { title, content, kind: editable && patch.kind ? patch.kind : item.kind, enabled: patch.enabled ?? item.enabled, embedding: embed(title, content), updated_at: nowIso() };
  await db().library.update(orgId, itemId, next);
  return { ...item, ...next };
}

/** Deletes an organization item; starters cannot be deleted (turn them off instead). */
export async function deleteLibraryItem(orgId: string, itemId: string): Promise<boolean> {
  const item = await db().library.get(orgId, itemId);
  if (!item || item.origin !== "ORGANIZATION") return false;
  await db().library.remove(orgId, itemId);
  return true;
}
