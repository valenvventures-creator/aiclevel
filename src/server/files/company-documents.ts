import "server-only";
import { can } from "@/server/auth/permissions";
import { cosine, lexicalEmbedding } from "@/server/memory/embeddings";
import type { FileRecord, Role } from "@/types/domain";
import { listCompanyFiles } from "./service";

/**
 * COMPANY DOCUMENTS — what every executive draws on.
 *
 * Company-wide files (the Files tab and the foundational documents uploaded
 * during onboarding) are searched for every request, by all seven executives,
 * whatever their memory areas. Each document is split into passages and only
 * the few passages most relevant to the question reach the model, within a
 * character budget. Files private to one executive (its Learning tab) are
 * excluded here; that executive reads them through its own library.
 */
export const COMPANY_DOC_LIMITS = {
  /** Most recent readable company files considered per request. */
  FILES: 80,
  /** Text read from each file (long documents: the first part). */
  CHARS_PER_FILE: 60_000,
  PASSAGE_CHARS: 1600,
  PER_ANSWER: 3,
  MAX_PER_FILE: 2,
  CHAR_BUDGET: 6000,
  MIN_SIMILARITY: 0.08,
} as const;

export interface DocumentExcerpt {
  fileId: string;
  filename: string;
  excerpt: string;
}

/** Splits text into passages of about `size` characters, keeping paragraphs together where possible. Pure. */
export function splitPassages(text: string, size: number = COMPANY_DOC_LIMITS.PASSAGE_CHARS): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > size) {
      if (cur) out.push(cur);
      cur = "";
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
      continue;
    }
    if (cur && cur.length + p.length + 2 > size) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Picks the passages most relevant to a question across company files. Pure. */
export function rankDocumentExcerpts(files: readonly Pick<FileRecord, "id" | "filename" | "extracted_text">[], query: string, limits = COMPANY_DOC_LIMITS): DocumentExcerpt[] {
  const qv = lexicalEmbedding(query);
  if (!qv.some((x) => x > 0)) return [];
  const scored: { file: (typeof files)[number]; passage: string; similarity: number }[] = [];
  for (const file of files) {
    const text = (file.extracted_text ?? "").slice(0, limits.CHARS_PER_FILE);
    if (!text.trim()) continue;
    for (const passage of splitPassages(text, limits.PASSAGE_CHARS)) {
      const similarity = cosine(qv, lexicalEmbedding(`${file.filename} ${passage}`));
      if (similarity >= limits.MIN_SIMILARITY) scored.push({ file, passage, similarity });
    }
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const out: DocumentExcerpt[] = [];
  const perFile = new Map<string, number>();
  let used = 0;
  for (const s of scored) {
    if (out.length >= limits.PER_ANSWER) break;
    const n = perFile.get(s.file.id) ?? 0;
    if (n >= limits.MAX_PER_FILE) continue;
    if (used + s.passage.length > limits.CHAR_BUDGET && out.length) continue;
    out.push({ fileId: s.file.id, filename: s.file.filename, excerpt: s.passage });
    perFile.set(s.file.id, n + 1);
    used += s.passage.length;
  }
  return out;
}

/** Company-document passages relevant to a request, for any executive. Never throws. */
export async function retrieveCompanyDocuments(args: { organizationId: string; query: string; viewerRole: Role; excludeFileIds?: readonly string[] }): Promise<DocumentExcerpt[]> {
  if (!can(args.viewerRole, "files.read") || !args.query.trim()) return [];
  try {
    const exclude = new Set(args.excludeFileIds ?? []);
    const files = (await listCompanyFiles(args.organizationId))
      .filter((f) => (f.extracted_text ?? "").trim() && !exclude.has(f.id))
      .slice(0, COMPANY_DOC_LIMITS.FILES);
    return rankDocumentExcerpts(files, args.query);
  } catch (err) {
    console.error("[company-documents] retrieval failed; answering without them", err);
    return [];
  }
}
