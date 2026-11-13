import "server-only";
import { dataMode } from "@/lib/env";
import { supabaseServer } from "@/server/db/supabase";
import { db, newId, nowIso } from "@/server/db/store";
import { hasPersistentStore } from "@/server/db/records";
import { lexicalEmbedding } from "@/server/memory/embeddings";
import { audit } from "@/server/audit";
import { canExtract, extractText } from "./extract";
import type { FileRecord, Organization } from "@/types/domain";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const BUCKET = "organization-files";

/** Allowlist by extension → canonical MIME. The browser-provided type is never trusted. */
export const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
};

const MAGIC: Record<string, number[]> = { pdf: [0x25, 0x50, 0x44, 0x46], png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff], docx: [0x50, 0x4b], pptx: [0x50, 0x4b], xlsx: [0x50, 0x4b] };

const CATEGORY: Record<string, string> = { pdf: "Document", docx: "Document", txt: "Document", md: "Document", pptx: "Presentation", xlsx: "Finance", csv: "Finance", png: "Image", jpg: "Image", jpeg: "Image", webp: "Image", mp3: "Audio", m4a: "Audio", wav: "Audio", mp4: "Video" };

export function validateUpload(filename: string, bytes: Uint8Array): { ok: true; ext: string; mime: string } | { ok: false; error: string } {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (!(ext in ALLOWED)) return { ok: false, error: "That file type is not supported." };
  if (bytes.byteLength === 0) return { ok: false, error: "The file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "Files must be 20 MB or smaller." };
  const magic = MAGIC[ext];
  if (magic && !magic.every((b, i) => bytes[i] === b)) return { ok: false, error: "The file contents do not match its extension." };
  return { ok: true, ext, mime: ALLOWED[ext] };
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 140) || "file";
}

/**
 * Non-Supabase file bytes: Netlify Blobs on Netlify (shared by every instance),
 * an in-process Map only for offline development and tests.
 */
const g = globalThis as unknown as { __taBlobs?: Map<string, Uint8Array> };
const memBlobs = (g.__taBlobs ??= new Map());
const blobs = {
  async store() {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "organization-files", consistency: "strong" });
  },
  async set(key: string, bytes: Uint8Array) {
    if (!hasPersistentStore()) return void memBlobs.set(key, bytes);
    await (await this.store()).set(key, new Blob([new Uint8Array(bytes)]));
  },
  async get(key: string): Promise<Uint8Array | undefined> {
    if (!hasPersistentStore()) return memBlobs.get(key);
    const buf = await (await this.store()).get(key, { type: "arrayBuffer" });
    return buf ? new Uint8Array(buf) : undefined;
  },
  async delete(key: string) {
    if (!hasPersistentStore()) return void memBlobs.delete(key);
    await (await this.store()).delete(key);
  },
};

/** Company-wide file (Files tab, onboarding) — not one executive's private upload. */
export function isCompanyFile(f: Pick<FileRecord, "executive_id" | "purpose">): boolean {
  return !f.executive_id && !f.purpose;
}

/** Files shared by the whole organization (every executive draws on them). */
export async function listCompanyFiles(orgId: string, opts: { limit?: number; projectId?: string } = {}): Promise<FileRecord[]> {
  const all = await db().files.list(orgId, { orderBy: "created_at", desc: true, ...(opts.projectId ? { where: { project_id: opts.projectId } } : {}) });
  const company = all.filter(isCompanyFile);
  return opts.limit ? company.slice(0, opts.limit) : company;
}

/**
 * Stores an upload. With `executiveId` the file is private to that executive
 * (its Learning tab): it is not added to C-Level Memory and not listed in Files.
 */
export async function storeFile(args: { organization: Organization; userId: string; filename: string; bytes: Uint8Array; projectId?: string | null; executiveId?: string | null; purpose?: FileRecord["purpose"] }): Promise<FileRecord> {
  const v = validateUpload(args.filename, args.bytes);
  if (!v.ok) throw new UploadError(v.error);
  const id = newId();
  const filename = safeFilename(args.filename);
  const storage_path = `${args.organization.id}/${id}/${filename}`;
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { error } = await sb.storage.from(BUCKET).upload(storage_path, args.bytes, { contentType: v.mime, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  } else await blobs.set(storage_path, args.bytes);

  // Text extraction (TXT, MD, CSV, PDF, DOCX, PPTX, XLSX) so executives can read the document.
  const readable = canExtract(v.ext);
  const extracted = readable ? await extractText(v.ext, args.bytes) : null;
  const rec: FileRecord = {
    id, organization_id: args.organization.id, project_id: args.projectId ?? null, uploaded_by: args.userId, filename, mime_type: v.mime, size: args.bytes.byteLength,
    storage_path, category: CATEGORY[v.ext] ?? "Document", processing_status: readable && !extracted ? "FAILED" : "READY", extracted_text: extracted, executive_id: args.executiveId ?? null, purpose: args.purpose ?? null, created_at: nowIso(),
  };
  await db().files.insert(rec);
  if (extracted && !args.executiveId && !args.purpose) {
    // Searchable document memory is PROPOSED until a human verifies it.
    await db().memory.insert({ id: newId(), organization_id: args.organization.id, project_id: rec.project_id, title: `Document: ${filename}`, content: extracted.slice(0, 1500), category: "DOCUMENTS", importance: 2, status: "PROPOSED", pinned: false, source_type: "UPLOADED_DOCUMENT", source_id: id, created_by: args.userId, verified_by: null, confidence: 0.7, embedding: lexicalEmbedding(extracted.slice(0, 4000)), visibility: "ORGANIZATION", executive_relevance: [], created_at: nowIso(), updated_at: nowIso() });
  }
  await audit(args.organization.id, args.userId, "file.upload", "file", id, { mime: v.mime, size: rec.size, ...(args.executiveId ? { executive_id: args.executiveId } : {}) });
  return rec;
}

/** Returns bytes (demo) or a short-lived signed URL (Supabase). Never a permanent public URL. */
export async function readFile(rec: FileRecord): Promise<{ bytes: Uint8Array } | { signedUrl: string } | null> {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(rec.storage_path, 60);
    return data?.signedUrl ? { signedUrl: data.signedUrl } : null;
  }
  const b = await blobs.get(rec.storage_path);
  return b ? { bytes: b } : null;
}

/**
 * Makes sure a document's text has been extracted, extracting it now for
 * files uploaded before their format was readable. Returns the text, or "".
 */
export async function ensureExtracted(rec: FileRecord): Promise<string> {
  if ((rec.extracted_text ?? "").trim()) return rec.extracted_text!;
  const ext = rec.filename.toLowerCase().split(".").pop() ?? "";
  if (!canExtract(ext)) return "";
  const stored = await readFile(rec);
  if (!stored) return "";
  const bytes = "bytes" in stored ? stored.bytes : new Uint8Array(await (await fetch(stored.signedUrl)).arrayBuffer());
  const text = (await extractText(ext, bytes)) ?? "";
  await db().files.update(rec.organization_id, rec.id, { extracted_text: text || null, processing_status: text ? "READY" : "FAILED" });
  return text;
}

const backfilled = new Set<string>();
const BACKFILL_PER_RUN = 10;

/**
 * Reads the text of documents uploaded before their format was readable
 * (e.g. PDFs and Word files from onboarding), so every executive can draw on
 * them. Runs once per organization per server instance, after the response.
 */
export async function backfillDocumentText(orgId: string): Promise<number> {
  if (backfilled.has(orgId)) return 0;
  backfilled.add(orgId);
  let done = 0;
  try {
    const pending = (await db().files.list(orgId)).filter((f) => f.processing_status === "PENDING" && !(f.extracted_text ?? "").trim() && canExtract(f.filename.toLowerCase().split(".").pop() ?? ""));
    for (const f of pending.slice(0, BACKFILL_PER_RUN)) {
      if (await ensureExtracted(f)) done++;
    }
    if (pending.length > BACKFILL_PER_RUN) backfilled.delete(orgId); // more next time
  } catch (err) {
    backfilled.delete(orgId);
    console.error("[files] reading older documents failed", orgId, err instanceof Error ? err.message : err);
  }
  return done;
}

export async function deleteFile(rec: FileRecord) {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.storage.from(BUCKET).remove([rec.storage_path]);
  } else await blobs.delete(rec.storage_path);
  await db().files.remove(rec.organization_id, rec.id);
}

export class UploadError extends Error {}
