import { ArrowRightLeft, CalendarCheck2, CheckCircle2, Circle, Mail, Phone, StickyNote, Trash2 } from "lucide-react";
import { ACTIVITY_LABEL } from "@/config/crm";
import { cn, formatRelative } from "@/lib/utils";
import { deleteActivityAction, toggleActivityAction } from "@/server/crm/actions";
import type { CrmActivity } from "@/types/domain";

const ICON = { NOTE: StickyNote, CALL: Phone, MEETING: CalendarCheck2, TASK: CheckCircle2, EMAIL: Mail, STAGE_CHANGE: ArrowRightLeft } as const;

/** Activity history for a contact or deal, newest first; open tasks can be ticked off. */
export function ActivityTimeline({ activities, authorName, canWrite, contextLabel }: { activities: CrmActivity[]; authorName: (id: string | null) => string; canWrite: boolean; contextLabel?: (a: CrmActivity) => string | null }) {
  if (!activities.length) return <p className="text-sm text-ivory-muted">No activity yet. Log calls, meetings, notes and tasks to build the client history.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {activities.map((a) => {
        const Icon = ICON[a.kind];
        const schedulable = a.kind === "TASK" || a.kind === "CALL" || a.kind === "MEETING";
        const overdue = schedulable && !a.done && a.due_at && a.due_at < new Date().toISOString();
        const ctx = contextLabel?.(a);
        return (
          <li key={a.id} className="relative">
            <span className={cn("absolute -left-[1.85rem] grid size-6 place-items-center rounded-full border bg-ink-950", a.kind === "STAGE_CHANGE" ? "border-line-gold text-gold-300" : "border-line-strong text-ivory-muted")}>
              <Icon className="size-3" aria-hidden />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint">{ACTIVITY_LABEL[a.kind].toUpperCase()}</span>
              <span className={cn("text-sm", a.done && schedulable && "text-ivory-muted line-through")}>{a.subject}</span>
              {ctx && <span className="text-xs text-ivory-faint">· {ctx}</span>}
            </div>
            {a.details && <p className="mt-1 whitespace-pre-wrap text-sm text-ivory-muted">{a.details}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ivory-faint">
              <span>{authorName(a.created_by)} · {formatRelative(a.created_at)}</span>
              {a.due_at && <span className={overdue ? "text-risk" : undefined}>{schedulable ? "Due" : "On"} {new Date(a.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
              {canWrite && schedulable && (
                <form action={toggleActivityAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="inline-flex items-center gap-1 text-gold-300 hover:text-gold-200">{a.done ? <><Circle className="size-3" aria-hidden /> Reopen</> : <><CheckCircle2 className="size-3" aria-hidden /> Mark done</>}</button>
                </form>
              )}
              {canWrite && a.kind !== "STAGE_CHANGE" && (
                <form action={deleteActivityAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="inline-flex items-center gap-1 hover:text-risk" aria-label={`Delete activity: ${a.subject}`}><Trash2 className="size-3" aria-hidden /> Delete</button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
