"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { testProviderAction } from "@/server/settings/actions";

export function TestConnection({ provider }: { provider: "anthropic" | "openai" }) {
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => start(async () => setRes(await testProviderAction(provider)))} className="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3 text-xs hover:border-line-gold">
        {pending && <Loader2 className="size-3 animate-spin" />} Test connection
      </button>
      {res && <span className={res.ok ? "text-xs text-ok" : "text-xs text-risk"} role="status">{res.message}</span>}
    </div>
  );
}
