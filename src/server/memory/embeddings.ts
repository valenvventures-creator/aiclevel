/**
 * Embeddings for C-Suite Memory.
 *
 * Production: provider embeddings (OpenAI text-embedding-3-small, 1536 dims)
 * stored in pgvector `memory_records.embedding`, searched with the
 * `match_memory_records` SQL function.
 *
 * Fallback (demo mode / no provider key): a deterministic hashed bag-of-words
 * vector. It is lexical, not semantic, and is labelled as such in the UI.
 */
export const LEXICAL_DIMS = 256;

const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with we our you your i".split(" "));

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/(ing|ed|es|s)$/, ""));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function lexicalEmbedding(text: string): number[] {
  const v = new Array<number>(LEXICAL_DIMS).fill(0);
  for (const t of tokenize(text)) v[hash(t) % LEXICAL_DIMS] += 1;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
