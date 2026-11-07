"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deleteReportAction } from "@/server/reports/actions";
import { cn } from "@/lib/utils";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-risk px-3 text-xs font-medium text-white disabled:opacity-60">
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />} Delete
    </button>
  );
}

/** Two-step delete: the first click asks for confirmation; nothing is deleted until "Delete" is pressed. */
export function DeleteReportButton({ id, title, from, compact = false }: { id: string; title: string; from: "list" | "detail"; compact?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete report: ${title}`}
        title="Delete report"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full text-ivory-muted transition hover:bg-risk/10 hover:text-risk",
          compact ? "size-8 justify-center" : "h-10 border border-line-strong px-4 text-sm hover:border-risk/40",
        )}
      >
        <Trash2 className="size-4" aria-hidden /> {!compact && "Delete report"}
      </button>
    );
  }
  return (
    <form action={deleteReportAction} role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-2xl border border-risk/30 bg-ink-900/95 p-2 pl-3 shadow-xl backdrop-blur">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="from" value={from} />
      <span className="text-xs text-ivory">Delete permanently? This can&apos;t be undone.</span>
      <ConfirmButton />
      <button type="button" autoFocus onClick={() => setConfirming(false)} className="h-8 rounded-full border border-line-strong px-3 text-xs text-ivory-muted hover:text-ivory">
        Cancel
      </button>
    </form>
  );
}
