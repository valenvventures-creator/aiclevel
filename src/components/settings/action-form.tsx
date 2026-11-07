"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import type { SettingsState } from "@/server/settings/actions";

/** Generic settings form: server action + success/error feedback. */
export function ActionForm({ action, submit = "Save", children, className }: { action: (s: SettingsState, fd: FormData) => Promise<SettingsState>; submit?: string; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.message && <Alert tone={state.shareLink ? "warn" : "ok"}>{state.message}</Alert>}
      {state.shareLink && <ShareLink url={state.shareLink} />}
      {children}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {submit}</Button>
    </form>
  );
}

function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-ink-900 p-2">
      <input readOnly value={url} aria-label="Invitation link" className="min-w-0 flex-1 bg-transparent px-2 text-xs text-ivory-muted outline-none" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded-full border border-line-gold px-3 py-1 text-xs text-gold-200"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
