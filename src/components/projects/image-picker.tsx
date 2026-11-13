"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

/** Upload a project cover image (optional). Submits image_file_id with the surrounding form. */
export function ImagePicker({ initialId }: { initialId?: string | null }) {
  const [id, setId] = useState<string | null>(initialId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/projects/images", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "The image could not be uploaded.");
      setId(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm">Project image <span className="text-ivory-faint">(optional)</span></p>
      {id ? (
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- authorized, per-organization image route */}
          <img src={`/api/projects/images/${id}`} alt="Project image preview" className="h-40 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <label className="cursor-pointer rounded-full bg-ink-950/80 px-3 py-1 text-xs backdrop-blur hover:text-gold-200">
              Replace
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            </label>
            <button type="button" onClick={() => setId(null)} className="inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-3 py-1 text-xs backdrop-blur hover:text-risk"><X className="size-3" aria-hidden /> Remove</button>
          </div>
          {busy && <div className="absolute inset-0 grid place-items-center bg-ink-950/60"><Loader2 className="size-6 animate-spin text-gold-300" aria-hidden /></div>}
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center transition hover:border-line-gold focus-within:ring-2 focus-within:ring-gold-400/40">
          {busy ? <Loader2 className="size-5 animate-spin text-gold-300" aria-hidden /> : <ImagePlus className="size-5 text-gold-300" aria-hidden />}
          <span className="text-sm">{busy ? "Uploading…" : <>Add an image <span className="text-gold-300">(choose file)</span></>}</span>
          <span className="text-xs text-ivory-faint">PNG, JPG or WebP · up to 8 MB · shown on the project card and map</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} aria-label="Add a project image" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </label>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs text-risk">{error}</p>}
      <input type="hidden" name="image_file_id" value={id ?? ""} />
    </div>
  );
}
