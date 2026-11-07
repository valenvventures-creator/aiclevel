"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Plus, Square, Trash2 } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Markdown } from "@/components/ui/markdown";
import { Alert, Label, Select, SimulatedBadge, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RunnerExec { id: string; title: string; short_title: string; avatar_url: string | null; accent: string; role_code: string }
export interface ModeOption { mode: string; label: string; description: string }

interface LiveTurn { executiveId: string; stage: string; text: string; status: "speaking" | "done" | "failed"; simulated?: boolean; error?: string }

const QUICK: { label: string; mode: string; prompt: string }[] = [
  { label: "Ask everyone", mode: "EXECUTIVE_ROUND", prompt: "" },
  { label: "CEO synthesis", mode: "CEO_SYNTHESIS", prompt: "" },
  { label: "Challenge assumptions", mode: "RED_TEAM", prompt: "" },
  { label: "Financial review", mode: "FINANCIAL_REVIEW", prompt: "" },
  { label: "Legal / risk review", mode: "RISK_REVIEW", prompt: "" },
  { label: "Technical review", mode: "EVIDENCE_CHECK", prompt: "" },
  { label: "People / operations", mode: "OPERATING_REVIEW", prompt: "" },
  { label: "Communications", mode: "MARKET_REVIEW", prompt: "" },
  { label: "Impact review", mode: "IMPACT_REVIEW", prompt: "" },
  { label: "Seek consensus", mode: "CONSENSUS", prompt: "" },
  { label: "Preserve dissent", mode: "DISSENT", prompt: "" },
  { label: "Executive vote", mode: "EXECUTIVE_VOTE", prompt: "" },
];

type StepEvent = { type: string; state?: string; executiveId?: string; executiveTitle?: string; stage?: string; label?: string; text?: string; error?: string; simulated?: boolean };

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
});

/** Bounds the client loop independently of the server (which also caps a round's steps). */
const MAX_CLIENT_STEPS = 60;
const MAX_BUSY_WAITS = 20;

export function SessionRunner({ sessionId, participants, modes, defaultMode, objective, autostart, resume, canRun }: { sessionId: string; participants: RunnerExec[]; modes: ModeOption[]; defaultMode: string; objective: string; autostart: boolean; resume: boolean; canRun: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState(autostart ? objective : "");
  const [mode, setMode] = useState(defaultMode);
  const [only, setOnly] = useState("");
  const [options, setOptions] = useState([{ id: "A", label: "" }, { id: "B", label: "" }]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ id: string; title: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const started = useRef(false);
  const map = new Map(participants.map((p) => [p.id, p]));

  function onEvent(ev: StepEvent) {
    if (ev.type === "stage") setStage(ev.label ?? null);
    else if (ev.type === "turn_start") {
      // A turn continued in a later step re-announces itself with the text so far.
      setTurns((t) => {
        const i = t.findIndex((x) => x.executiveId === ev.executiveId && x.stage === ev.stage && x.status === "speaking");
        if (i === -1) return [...t, { executiveId: ev.executiveId!, stage: ev.stage!, text: ev.text ?? "", status: "speaking" }];
        return t.map((x, j) => (j === i ? { ...x, text: ev.text ?? x.text } : x));
      });
    } else if (ev.type === "delta") setTurns((t) => t.map((x) => (x.executiveId === ev.executiveId && x.status === "speaking" ? { ...x, text: x.text + (ev.text ?? "") } : x)));
    else if (ev.type === "turn_end") setTurns((t) => t.map((x) => (x.executiveId === ev.executiveId && x.status === "speaking" ? { ...x, status: "done", simulated: ev.simulated } : x)));
    else if (ev.type === "turn_failed") {
      setTurns((t) => t.map((x) => (x.executiveId === ev.executiveId && x.status === "speaking" ? { ...x, status: "failed", error: ev.error } : x)));
      setFailures((f) => [...f, { id: ev.executiveId!, title: ev.executiveTitle ?? "Executive" }]);
    } else if (ev.type === "error") setError(ev.error ?? "Session error");
  }

  /** Runs one bounded server step; returns how the step ended. */
  async function step(signal: AbortSignal): Promise<string> {
    const res = await fetch(`/api/sessions/${sessionId}/step`, { method: "POST", signal });
    if (res.status === 429) return "busy";
    if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The session could not continue.");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let ended = "interrupted";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line) as StepEvent;
        if (ev.type === "step_end") {
          ended = ev.state ?? "continue";
          if (ev.state === "failed" && ev.error) setError(ev.error);
        } else onEvent(ev);
      }
    }
    return ended;
  }

  /** Drives the round step by step until it finishes, fails or is stopped. */
  async function drive(ctrl: AbortController) {
    let busy = 0;
    let interrupted = 0;
    for (let i = 0; i < MAX_CLIENT_STEPS && !ctrl.signal.aborted; i++) {
      const state = await step(ctrl.signal);
      if (state === "done" || state === "idle" || state === "failed") return;
      if (state === "busy") {
        // Another tab (or a step cut off a moment ago) holds the round; its lease expires shortly.
        if (++busy > MAX_BUSY_WAITS) throw new Error("The session is busy in another window. Refresh the page to follow it.");
        await wait(3000, ctrl.signal);
      } else if (state === "interrupted") {
        // The connection dropped mid-step; the server saved progress, so pick up again.
        if (++interrupted > 3) throw new Error("The connection was interrupted. Refresh the page to resume the session.");
        await wait(1500, ctrl.signal);
      } else busy = 0;
    }
  }

  async function begin(work: (ctrl: AbortController) => Promise<void>) {
    setRunning(true);
    setError(null);
    setTurns([]);
    setFailures([]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await work(ctrl);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
      setStage(null);
      abortRef.current = null;
      router.refresh();
    }
  }

  async function run(override?: { message?: string; mode?: string; only?: string }) {
    const msg = (override?.message ?? message).trim();
    if (!msg || running) return;
    await begin(async (ctrl) => {
      const m = override?.mode ?? mode;
      const res = await fetch(`/api/sessions/${sessionId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, mode: m, onlyExecutiveId: (override?.only ?? only) || undefined, voteOptions: m === "EXECUTIVE_VOTE" ? options.filter((o) => o.label.trim()) : undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The session could not run.");
      setMessage("");
      await drive(ctrl);
    });
  }

  async function stop() {
    abortRef.current?.abort();
    await fetch(`/api/sessions/${sessionId}/run`, { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  }

  useEffect(() => {
    if (started.current || !canRun) return;
    if (resume) {
      started.current = true;
      queueMicrotask(() => void begin(drive)); // resume an unfinished round
    } else if (autostart) {
      started.current = true;
      window.history.replaceState(null, "", `/sessions/${sessionId}`);
      queueMicrotask(() => void run({ message: objective }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Live turns render only while running; afterwards the persisted transcript (server) takes over.
  const live = running ? turns : turns.filter((t) => t.status === "failed");

  return (
    <div className="space-y-6">
      {(running || live.length > 0) && (
        <section aria-live="polite" aria-label="Live session" className="space-y-4">
          {stage && (
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line-gold" />
              <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-gold-300"><Loader2 className="size-3 animate-spin" /> {stage.toUpperCase()}</span>
              <span className="h-px flex-1 bg-line-gold" />
            </div>
          )}
          {live.map((t, i) => {
            const e = map.get(t.executiveId);
            if (!e) return null;
            return (
              <article key={`${t.executiveId}-${i}`} className={cn("flex gap-3 rounded-2xl border p-4", t.status === "speaking" ? "border-line-gold bg-gold-400/[0.03]" : t.status === "failed" ? "border-risk/30" : "border-line")}>
                <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={36} ring={false} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: e.accent }}>{e.title}</span>
                    {t.status === "speaking" && <SpeakingIndicator />}
                    {t.simulated && <SimulatedBadge />}
                  </div>
                  {t.status === "failed" ? (
                    <p className="text-sm text-risk">{e.title} could not complete the analysis.</p>
                  ) : t.text ? <Markdown>{t.text}</Markdown> : <p className="text-sm text-ivory-faint">Preparing position…</p>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {error && <Alert tone="risk">{error}</Alert>}
      {failures.length > 0 && !running && (
        <Alert tone="warn">
          {failures.map((f) => (
            <span key={f.id} className="mr-3 inline-flex items-center gap-2">
              {f.title} could not complete the analysis.
              <button onClick={() => run({ message: objective, only: f.id, mode: "EXECUTIVE_ROUND" })} className="underline underline-offset-2">Retry {f.title.split(" ").map((w) => w[0]).join("")} analysis?</button>
            </span>
          ))}
        </Alert>
      )}

      {canRun && (
        <section aria-label="Session controls" className="plate space-y-4 p-5">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q.label} type="button" disabled={running} onClick={() => setMode(q.mode)} aria-pressed={mode === q.mode} className={cn("rounded-full border px-3 py-1.5 text-xs transition", mode === q.mode ? "border-line-gold bg-gold-400/10 text-gold-200" : "border-line text-ivory-muted hover:border-line-strong hover:text-ivory")}>
                {q.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ivory-muted">{modes.find((m) => m.mode === mode)?.description}</p>
          {mode === "EXECUTIVE_VOTE" && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-ivory-muted">Options to vote on</legend>
              {options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="w-6 font-mono text-xs text-gold-300">{o.id}</span>
                  <input value={o.label} onChange={(e) => setOptions((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={`Option ${o.id}`} aria-label={`Option ${o.id}`} className="h-9 flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 text-sm" />
                  {options.length > 2 && <button type="button" onClick={() => setOptions((s) => s.filter((_, j) => j !== i))} aria-label={`Remove option ${o.id}`} className="text-ivory-faint hover:text-risk"><Trash2 className="size-4" /></button>}
                </div>
              ))}
              {options.length < 6 && <button type="button" onClick={() => setOptions((s) => [...s, { id: String.fromCharCode(65 + s.length), label: "" }])} className="inline-flex items-center gap-1 text-xs text-gold-300"><Plus className="size-3" /> Add option</button>}
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <Label htmlFor="session-msg">Your question to the C-Suite</Label>
              <Textarea id="session-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="What should the C-Suite consider?" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }} />
            </div>
            <div>
              <Label htmlFor="session-only">Call on</Label>
              <Select id="session-only" value={only} onChange={(e) => setOnly(e.target.value)}>
                <option value="">All participants</option>
                {participants.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="hidden text-[11px] text-ivory-faint sm:inline">⌘/Ctrl + Enter to convene · bounded to {participants.length} executives</span>
            {running ? (
              <Button type="button" variant="outline" onClick={() => void stop()}><Square className="size-3 fill-current" /> Stop session</Button>
            ) : (
              <Button type="button" onClick={() => run()} disabled={!message.trim()}><Play className="size-4" /> Convene</Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export function SpeakingIndicator() {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label="Speaking">
      {[0, 1, 2].map((i) => <span key={i} className="w-0.5 animate-pulse-soft rounded-full bg-gold-400" style={{ height: 6 + i * 3, animationDelay: `${i * 150}ms` }} />)}
    </span>
  );
}
