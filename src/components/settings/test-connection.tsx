"use client";

import { cn } from "@/lib/utils";
import type { ProviderCheck } from "@/server/ai/provider-check";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { testProviderAction } from "@/server/settings/actions";

export function TestConnection({ provider }: { provider: "anthropic" | "openai" }) {
  const [res, setRes] = useState<ProviderCheck | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <button type="button" onClick={() => start(async () => setRes(await testProviderAction(provider)))} disabled={pending} className="inline-flex h-8 items-center gap-2 self-start rounded-full border border-line-strong px-3 text-xs hover:border-line-gold sm:self-end">
        {pending && <Loader2 className="size-3 animate-spin" />} {pending ? "Testing…" : "Test connection"}
      </button>
      {res && (
        <div role="status" className={cn("w-full max-w-md rounded-lg border px-3 py-2 text-xs sm:text-right", res.ok ? "border-ok/40 text-ok" : "border-risk/40 text-risk")}>
          <p>{res.message}</p>
          {res.keyHint && <p className="mt-1 font-mono text-[10px] text-ivory-faint">Saved key: {res.keyHint}</p>}
          {res.steps && res.steps.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-left text-ivory-muted">
              {res.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
