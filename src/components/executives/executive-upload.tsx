"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, Upload, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md";
const MAX_FILES = 10;

type Item = { key: string; name: string; status: "uploading" | "done" | "error"; message?: string };

/**
 * Upload documents for ONE executive (Learning tab). Each file is private to
 * that executive: its text joins the executive's own knowledge, it is not
 * listed in Files and not added to C-Level Memory.
 */
export function ExecutiveUpload({ slug, shortTitle }: { slug: string; shortTitle: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const busy = items.some((i) => i.status === "uploading");

  const set = (key: string, patch: Partial<Item>) => setItems((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function upload(list: File[]) {
    const queued = list.slice(0, MAX_FILES).map((file, i) => ({ file, key: `${Date.now()}-${i}-${file.name}` }));
    setItems((s) => [...queued.map(({ file, key }) => ({ key, name: file.name, status: "uploading" as const })), ...s]);
    let added = false;
    for (const { file, key } of queued) {
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(`/api/executives/${encodeURIComponent(slug)}/documents`, { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
        if (res.ok && json.ok) {
          added = true;
          set(key, { status: "done", message: json.message });
        } else set(key, { status: "error", message: json.error ?? (res.status === 413 ? "This file is too large to upload." : "Upload failed.") });
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
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition focus-within:border-line-gold focus-within:ring-2 focus-within:ring-gold-400/40",
          over ? "border-gold-300 bg-gold-400/[0.06]" : "border-line-strong hover:border-line-gold hover:bg-gold-400/[0.03]",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? <Loader2 className="size-6 animate-spin text-gold-300" aria-hidden /> : <Upload className="size-6 text-gold-300" aria-hidden />}
        <span className="text-sm">{busy ? "Uploading…" : <>Drop files here or <span className="text-gold-300">choose files</span></>}</span>
        <span className="inline-flex items-center gap-1 text-xs text-ivory-faint"><Lock className="size-3" aria-hidden /> Only the {shortTitle} uses these</span>
        <span className="text-[11px] text-ivory-faint">PDF, Word, PowerPoint, Excel, CSV, TXT or Markdown</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          className="sr-only"
          aria-label={`Upload documents for the ${shortTitle} only`}
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
                {i.status === "uploading" && <span className="ml-auto shrink-0 text-xs text-ivory-muted">Reading…</span>}
              </div>
              {i.message && <p className={cn("mt-1 text-xs", i.status === "error" ? "text-risk" : "text-ivory-muted")}>{i.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
