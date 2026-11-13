"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { CRM_PIPELINE } from "@/config/crm";
import { cn } from "@/lib/utils";
import { moveDealAction } from "@/server/crm/actions";
import type { CrmStage } from "@/types/domain";

/** The seven stages as a progress bar; click a stage to move the deal there. */
export function StageBar({ dealId, stage, canMove }: { dealId: string; stage: CrmStage; canMove: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<CrmStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = CRM_PIPELINE.findIndex((s) => s.key === stage);
  return (
    <div>
      <ol className="grid grid-cols-7 gap-1" aria-label="Deal stage">
        {CRM_PIPELINE.map((s, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={s.key} className="min-w-0">
              <button
                type="button"
                disabled={!canMove || here || pending}
                aria-current={here ? "step" : undefined}
                title={canMove && !here ? `Move to ${s.label}` : s.label}
                onClick={() => {
                  setTarget(s.key);
                  setError(null);
                  start(async () => {
                    const r = await moveDealAction(dealId, s.key);
                    if (!r.ok) setError(r.error);
                    router.refresh();
                  });
                }}
                className={cn(
                  "group flex w-full flex-col items-stretch gap-1.5 text-left disabled:cursor-default",
                  canMove && !here && "cursor-pointer",
                )}
              >
                <span className={cn("h-1.5 rounded-full transition", here ? "bg-gold-300" : done ? "bg-gold-500/70" : "bg-ink-700 group-enabled:group-hover:bg-gold-400/40")} />
                <span className={cn("flex items-center gap-1 truncate text-[11px]", here ? "text-gold-200" : done ? "text-ivory-muted" : "text-ivory-faint")}>
                  {pending && target === s.key ? <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden /> : done ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                  <span className="truncate">{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-2 text-xs text-risk">{error}</p>}
    </div>
  );
}
