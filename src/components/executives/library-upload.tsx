"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { addLibraryDocumentAction } from "@/server/executives/learning-actions";

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md";
const MAX_FILES = 10;

type Item = { key: string; name: string; status: "uploading" | "reading" | "done" | "error"; message?: string };

/**
 * Upload documents straight into one executive's library: each file is
 * stored in Files, its text is read, and that text joins the library.
 */
export function LibraryUpload({ executiveId, executiveShortTitle, compact = false }: { executiveId: string; executiveShortTitle: string; compact?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const busy = items.some((i) => i.status === "uploading" || i.status === "reading");

  const set = (key: string, patch: Partial<Item>) => setItems((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function upload(list: File[]) {
    const files = list.slice(0, MAX_FILES);
    const queued = files.map((f, i) => ({ file: f, key: `${Date.now()}-${i}-${f.name}` }));
    setItems((s) => [...queued.map(({ file, key }) => ({ key, name: file.name, status: "uploading" as const })), ...s]);
    let added = false;
    for (const { file, key } of queued) {
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/files", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !json.id) {
          set(key, { status: "error", message: json.error ?? (res.status === 413 ? "This file is too large to upload." : "Upload failed.") });
          continue;
        }
        set(key, { status: "reading" });
        const fd = new FormData();
        fd.append("executive_id", executiveId);
        fd.append("file_id", json.id);
        const r = await addLibraryDocumentAction({}, fd);
        if (r.error) set(key, { status: "error", message: r.error });
        else {
          added = true;
          set(key, { status: "done", message: r.message ?? "Added to the library." });
        }
      } catch {
        set(key, { status: "error", message: "Upload failed. Check your connection and try again." });
      }
    }
    if (list.length > MAX_FILES) setItems((s) => [{ key: `limit-${Date.now()}`, name: `${list.length - MAX_FILES} more file(s)`, status: "error", message: `Up to ${MAX_FILES} files at a time.` }, ...s]);
    if (added) router.refresh();
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    if (!busy && e.dataTransfer.files.length) void upload(Array.from(e.dataTransfer.files));
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center transition focus-within:border-line-gold focus-within:ring-2 focus-within:ring-gold-400/40",
          compact ? "py-6" : "py-8",
          over ? "border-gold-300 bg-gold-400/[0.06]" : "border-line-strong hover:border-line-gold hover:bg-gold-400/[0.03]",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? <Loader2 className="size-6 animate-spin text-gold-300" aria-hidden /> : <Upload className="size-6 text-gold-300" aria-hidden />}
        <span className="text-sm">{busy ? "Adding to the library…" : <>Drop files here or <span className="text-gold-300">choose files</span></>}</span>
        <span className="text-xs text-ivory-faint">PDF, Word, PowerPoint, Excel, CSV, TXT or Markdown</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          className="sr-only"
          aria-label={`Upload documents to the ${executiveShortTitle}'s library`}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void upload(files);
          }}
        />
      </label>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="rounded-xl border border-line px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {i.status === "done" ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden /> : i.status === "error" ? <XCircle className="size-4 shrink-0 text-risk" aria-hidden /> : <Loader2 className="size-4 shrink-0 animate-spin text-ivory-muted" aria-hidden />}
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="ml-auto shrink-0 text-xs text-ivory-muted">{i.status === "uploading" ? "Uploading…" : i.status === "reading" ? "Reading…" : null}</span>
              </div>
              {i.message && <p className={cn("mt-1 text-xs", i.status === "error" ? "text-risk" : "text-ivory-muted")}>{i.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
