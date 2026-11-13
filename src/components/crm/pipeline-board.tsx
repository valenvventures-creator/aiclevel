"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Plus, Search, Trophy } from "lucide-react";
import { CRM_PIPELINE, STAGE_BY_KEY, formatMoney } from "@/config/crm";
import { summarizePipeline } from "@/lib/crm-summary";
import { cn } from "@/lib/utils";
import { moveDealAction } from "@/server/crm/actions";
import type { CrmDeal, CrmStage } from "@/types/domain";

export interface BoardDeal extends Pick<CrmDeal, "id" | "name" | "company" | "amount" | "currency" | "stage" | "probability" | "expected_close" | "next_step" | "owner_id" | "status" | "stage_changed_at" | "contact_id"> {
  contactName: string | null;
}

/** Days since an ISO date (outside render so components stay pure). */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
function isOverdue(date: string | null): boolean {
  return Boolean(date) && date! < new Date().toISOString().slice(0, 10);
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

// Prefer the column under the pointer; fall back to overlap (keyboard/touch edges).
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/**
 * The sales pipeline as a drag-and-drop board: seven stage columns, deals as
 * cards. Moves are applied instantly and saved in the background; if saving
 * fails the card returns to where it was. Every card also has a "Move to"
 * menu, so the board works by keyboard, screen reader and on small screens.
 */
export function PipelineBoard({ initialDeals, lostDeals, owners, meId, canWrite, currency }: { initialDeals: BoardDeal[]; lostDeals: { owner_id: string | null }[]; owners: { id: string; name: string }[]; meId: string; canWrite: boolean; currency: string }) {
  const [deals, setDeals] = useState(initialDeals);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "risk"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const ownerName = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const visible = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return deals.filter((d) => {
      if (owner === "me" ? d.owner_id !== meId : owner !== "all" && d.owner_id !== owner) return false;
      if (!words.length) return true;
      const hay = `${d.name} ${d.company ?? ""} ${d.contactName ?? ""} ${d.next_step ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [deals, q, owner, meId]);
  // Lost deals are off the board but count toward the win rate (same owner filter).
  const lostVisible = useMemo(() => lostDeals.filter((d) => (owner === "me" ? d.owner_id === meId : owner === "all" || d.owner_id === owner)), [lostDeals, owner, meId]);
  const summary = useMemo(() => summarizePipeline([...visible, ...lostVisible.map(() => ({ stage: "PROSPECT" as const, amount: 0, probability: 0, status: "LOST" as const }))]), [visible, lostVisible]);
  const active = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function move(id: string, stage: CrmStage) {
    const before = deals.find((d) => d.id === id);
    if (!before || before.stage === stage || !canWrite) return;
    const label = STAGE_BY_KEY[stage].label;
    setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, stage, probability: STAGE_BY_KEY[stage].probability, stage_changed_at: new Date().toISOString() } : d)));
    setStatus(null);
    startTransition(async () => {
      const r = await moveDealAction(id, stage);
      if (!r.ok) {
        setDeals((cur) => cur.map((d) => (d.id === id ? before : d)));
        setStatus({ tone: "risk", text: `Couldn't move “${before.name}”: ${r.error}` });
        return;
      }
      setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, ...r.deal } : d)));
      setStatus({ tone: "ok", text: `“${before.name}” moved to ${label}.` });
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (e.over) move(String(e.active.id), e.over.id as CrmStage);
  }

  return (
    <div className="min-w-0 space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Open pipeline", formatMoney(summary.openValue, currency), `${summary.openCount} open ${summary.openCount === 1 ? "deal" : "deals"}`],
          ["Weighted forecast", formatMoney(summary.weightedForecast, currency), "Value × win probability"],
          ["Won", formatMoney(summary.wonValue, currency), `${summary.wonCount} in Onboard & Manage`],
          ["Win rate", summary.winRate === null ? "—" : `${summary.winRate}%`, `${summary.lostCount} lost`],
          ["In Close", formatMoney(summary.stages.find((s) => s.stage === "CLOSE")!.amount, currency), `${summary.stages.find((s) => s.stage === "CLOSE")!.count} about to close`],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-line bg-ink-900/60 p-4">
            <dt className="font-mono text-[10px] tracking-[0.16em] text-ivory-faint">{k.toUpperCase()}</dt>
            <dd className="mt-1 font-heading text-2xl text-gold-100">{v}</dd>
            <dd className="mt-0.5 text-xs text-ivory-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ivory-faint" aria-hidden />
          <label htmlFor="deal-search" className="sr-only">Search deals</label>
          <input id="deal-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals, companies, contacts" className="h-10 w-full rounded-full border border-line-strong bg-ink-900 pl-9 pr-3 text-sm" />
        </div>
        <label htmlFor="deal-owner" className="sr-only">Owner</label>
        <select id="deal-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 rounded-full border border-line-strong bg-ink-900 px-3 text-sm">
          <option value="all">All owners</option>
          <option value="me">My deals</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <p className="ml-auto hidden text-xs text-ivory-faint md:block">Drag a card to another stage, or use its Move to menu.</p>
      </div>

      <p role="status" aria-live="polite" className={cn("text-sm", !status && "sr-only", status?.tone === "risk" ? "text-risk" : "text-ok")}>{status?.text}</p>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active: a }) => `Picked up ${deals.find((d) => d.id === a.id)?.name ?? "deal"}.`,
            onDragOver: ({ over }) => (over ? `Over ${STAGE_BY_KEY[over.id as CrmStage]?.label ?? "a stage"}.` : "Not over a stage."),
            onDragEnd: ({ active: a, over }) => (over ? `${deals.find((d) => d.id === a.id)?.name ?? "Deal"} dropped in ${STAGE_BY_KEY[over.id as CrmStage]?.label}.` : "Dropped outside the board; nothing changed."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0" role="region" aria-label="Sales pipeline" tabIndex={0}>
          <div className="flex w-max gap-3">
            {CRM_PIPELINE.map((s) => {
              const col = visible.filter((d) => d.stage === s.key);
              const total = col.reduce((n, d) => n + (d.amount ?? 0), 0);
              return (
                <Column key={s.key} stage={s.key} label={s.label} hint={s.hint} won={s.won} accent={s.accent} count={col.length} total={formatMoney(total, currency)} canWrite={canWrite}>
                  {col.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ivory-faint">{canWrite ? "Drop a deal here" : "No deals"}</p>
                  ) : (
                    col.map((d) => <DealCard key={d.id} deal={d} ownerName={d.owner_id ? ownerName.get(d.owner_id) ?? null : null} canWrite={canWrite} onMove={move} dimmed={activeId === d.id} />)
                  )}
                </Column>
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{active ? <CardBody deal={active} ownerName={active.owner_id ? ownerName.get(active.owner_id) ?? null : null} lifted /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ stage, label, hint, won, accent, count, total, canWrite, children }: { stage: CrmStage; label: string; hint: string; won: boolean; accent: string; count: number; total: string; canWrite: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !canWrite });
  return (
    <section ref={setNodeRef} aria-label={`${label}: ${count} ${count === 1 ? "deal" : "deals"}, ${total}`} className={cn("flex w-[17rem] shrink-0 flex-col rounded-2xl border bg-ink-950/60 transition", isOver ? "border-gold-300 bg-gold-400/[0.05]" : "border-line")}>
      <header className="rounded-t-2xl border-b border-line px-3 pb-2.5 pt-3" style={{ boxShadow: `inset 0 3px 0 ${accent}` }}>
        <div className="flex items-center gap-2">
          <h2 className="truncate font-heading text-sm font-semibold">{label}</h2>
          {won && <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/[0.08] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-ok"><Trophy className="size-2.5" aria-hidden /> WON</span>}
          <span className="ml-auto rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[10px] text-ivory-muted">{count}</span>
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-gold-200">{total}</p>
        <p className="mt-0.5 truncate text-[11px] text-ivory-faint">{hint}</p>
      </header>
      <div className="flex min-h-40 flex-1 flex-col gap-2 p-2">{children}</div>
      {canWrite && (
        <Link href={`/crm/deals/new?stage=${stage}`} className="m-2 mt-0 inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-ivory-muted transition hover:border-line-gold hover:text-gold-200">
          <Plus className="size-3.5" aria-hidden /> Add deal
        </Link>
      )}
    </section>
  );
}

function DealCard({ deal, ownerName, canWrite, onMove, dimmed }: { deal: BoardDeal; ownerName: string | null; canWrite: boolean; onMove: (id: string, stage: CrmStage) => void; dimmed: boolean }) {
  // Pointer and touch drag only; keyboard and screen-reader users use the Move to menu.
  const { listeners, setNodeRef, transform } = useDraggable({ id: deal.id, disabled: !canWrite });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...listeners} className={cn("touch-manipulation", canWrite && "cursor-grab active:cursor-grabbing", dimmed && "opacity-40")}>
      <CardBody deal={deal} ownerName={ownerName}>
        {canWrite && (
          <select
            aria-label={`Move ${deal.name} to stage`}
            value={deal.stage}
            onChange={(e) => onMove(deal.id, e.target.value as CrmStage)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="mt-2 h-7 w-full rounded-lg border border-line bg-ink-900 px-2 text-[11px] text-ivory-muted"
          >
            {CRM_PIPELINE.map((s) => <option key={s.key} value={s.key}>{s.key === deal.stage ? `In ${s.label}` : `Move to ${s.label}`}</option>)}
          </select>
        )}
      </CardBody>
    </div>
  );
}

function CardBody({ deal, ownerName, lifted, children }: { deal: BoardDeal; ownerName: string | null; lifted?: boolean; children?: React.ReactNode }) {
  const days = daysSince(deal.stage_changed_at);
  const overdue = isOverdue(deal.expected_close) && !STAGE_BY_KEY[deal.stage].won;
  return (
    <article className={cn("rounded-xl border border-line bg-ink-900 p-3 text-sm transition hover:border-line-gold/70", lifted && "rotate-1 border-gold-300 shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)]")}>
      <div className="flex items-start gap-2">
        <Link href={`/crm/deals/${deal.id}`} className="min-w-0 flex-1 font-medium leading-snug hover:text-gold-100" onPointerDown={(e) => e.stopPropagation()}>{deal.name}</Link>
        <span className="shrink-0 font-mono text-xs text-gold-200">{formatMoney(deal.amount, deal.currency)}</span>
      </div>
      {(deal.company || deal.contactName) && <p className="mt-1 truncate text-xs text-ivory-muted">{[deal.company, deal.contactName].filter(Boolean).join(" · ")}</p>}
      {deal.next_step && <p className="mt-1.5 line-clamp-2 text-xs text-ivory-faint">Next: {deal.next_step}</p>}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ivory-faint">
        {deal.expected_close && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-risk")} title={overdue ? "Expected close date has passed" : "Expected close"}>
            <CalendarClock className="size-3" aria-hidden /> {new Date(`${deal.expected_close}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        <span title="Days in this stage">{days}d in stage</span>
        <span className="ml-auto font-mono">{deal.probability}%</span>
        {ownerName && <span title={`Owner: ${ownerName}`} className="grid size-6 place-items-center rounded-full border border-line-gold/60 bg-gold-400/[0.08] font-mono text-[9px] text-gold-200">{initials(ownerName)}</span>}
      </div>
      {children}
    </article>
  );
}
