"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, BookmarkPlus, Check, Copy, CornerUpRight, Globe, Loader2, Mic, MicOff, Pencil, Play, RotateCcw, Square, Users, Volume2 } from "lucide-react";
import { FeedbackButtons } from "@/components/executives/feedback-buttons";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Markdown } from "@/components/ui/markdown";
import { Alert, SimulatedBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { bringToSessionAction, forwardToExecutivesAction, saveMessageToMemoryAction } from "@/server/conversations/actions";

export interface UIMessage {
  id: string;
  role: "user" | "executive";
  content: string;
  simulated?: boolean;
  model?: string | null;
  pending?: boolean;
  /** This person's earlier rating of the answer, if any. */
  rating?: "UP" | "DOWN" | null;
}

interface ExecLite {
  id: string;
  slug: string;
  title: string;
  short_title: string;
  avatar_url: string | null;
  accent: string;
  primary_question: string;
}

type SpeechRec = { start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; continuous: boolean; interimResults: boolean };

export function ExecutiveConversation({ exec, others, conversationId: initialId, initialMessages, canWrite, canRate = false, suggestions }: { exec: ExecLite; others: ExecLite[]; conversationId: string | null; initialMessages: UIMessage[]; canWrite: boolean; canRate?: boolean; suggestions: string[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialId);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string, opts: { regenerate?: boolean } = {}) {
    const content = text.trim();
    if ((!content && !opts.regenerate) || streaming) return;
    setError(null);
    setNotice(null);
    setActivity(null);
    setStreaming(true);
    const placeholder: UIMessage = { id: `pending-${Date.now()}`, role: "executive", content: "", pending: true };
    setMessages((m) => {
      const base = opts.regenerate ? m.slice(0, m[m.length - 1]?.role === "executive" ? -1 : undefined) : [...m, { id: `u-${Date.now()}`, role: "user" as const, content }];
      return [...base, placeholder];
    });
    setInput("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const lastUser = opts.regenerate ? [...messages].reverse().find((m) => m.role === "user")?.content ?? "" : content;
      const res = await fetch(`/api/executives/${exec.slug}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message: lastUser || "Continue.", regenerate: Boolean(opts.regenerate) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "The executive could not respond.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; error?: string; conversationId?: string; simulated?: boolean; model?: string; messageId?: string };
          if (ev.type === "conversation" && ev.conversationId) {
            // Update the URL without a navigation so the stream is not interrupted.
            if (!conversationId) window.history.replaceState(null, "", `/executives/${exec.slug}?tab=conversation&c=${ev.conversationId}`);
            setConversationId(ev.conversationId);
          } else if (ev.type === "meta") setMessages((m) => m.map((x) => (x.id === placeholder.id ? { ...x, simulated: ev.simulated, model: ev.model } : x)));
          else if (ev.type === "notice") setNotice(ev.text ?? null);
          else if (ev.type === "activity") setActivity(ev.text ?? null);
          else if (ev.type === "delta") {
            setActivity(null);
            setMessages((m) => m.map((x) => (x.id === placeholder.id ? { ...x, content: x.content + (ev.text ?? "") } : x)));
          }
          else if (ev.type === "error") setError(ev.error ?? "Unknown error");
          else if (ev.type === "done" && ev.messageId) setMessages((m) => m.map((x) => (x.id === placeholder.id ? { ...x, id: ev.messageId!, pending: false } : x)));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setStreaming(false);
      setActivity(null);
      abortRef.current = null;
      setMessages((m) => m.filter((x) => !(x.pending && !x.content)).map((x) => ({ ...x, pending: false })));
      router.refresh();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function toggleVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => setInput((v) => `${v}${v ? " " : ""}${e.results[0][0].transcript}`);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const lastExecIdx = messages.map((m) => m.role).lastIndexOf("executive");

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-6 pb-6" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <ExecutiveAvatar src={exec.avatar_url} shortTitle={exec.short_title} accent={exec.accent} size={72} />
            <p className="mt-5 font-heading text-2xl">Your private office with the {exec.title}.</p>
            <p className="mt-2 max-w-md font-accent text-lg italic text-ivory-muted">“{exec.primary_question.replace(/[“”"]/g, "")}”</p>
            <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={!canWrite} className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-ivory-muted transition hover:border-line-gold hover:text-ivory">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageRow key={m.id} m={m} exec={exec} others={others} canRate={canRate} isLastExec={i === lastExecIdx} streaming={streaming} conversationId={conversationId} onRegenerate={() => send("", { regenerate: true })} onEdit={() => setInput(m.content)} onContinue={() => send("Continue from where you left off.")} />
        ))}
        {streaming && activity && (
          <p role="status" className="flex items-center gap-2 pl-12 text-xs text-gold-300">
            <Globe className="size-3.5 animate-pulse" aria-hidden /> {activity}
          </p>
        )}
        {notice && <Alert tone="warn">{notice}</Alert>}
        {error && (
          <Alert tone="risk">
            {exec.title} could not complete the response. {error}{" "}
            <button onClick={() => send("", { regenerate: true })} className="underline underline-offset-2">Retry</button>
          </Alert>
        )}
        <div ref={endRef} />
      </div>

      {canWrite ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="sticky bottom-4 rounded-2xl border border-line-strong bg-ink-900/95 p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur"
        >
          <label htmlFor="composer" className="sr-only">Message the {exec.title}</label>
          <textarea
            id="composer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder={`Ask the ${exec.title}…`}
            className="block w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ivory-faint"
          />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <button type="button" onClick={toggleVoice} className={cn("grid size-9 place-items-center rounded-lg text-ivory-faint hover:bg-white/5 hover:text-ivory", listening && "text-gold-300")} aria-label={listening ? "Stop voice input" : "Start voice input"} aria-pressed={listening}>
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>
              <span className="hidden text-[11px] text-ivory-faint sm:inline">Enter to send · Shift+Enter for a new line</span>
            </div>
            {streaming ? (
              <button type="button" onClick={stop} className="flex h-9 items-center gap-2 rounded-full border border-line-strong px-3 text-xs" aria-label="Stop generation">
                <Square className="size-3 fill-current" /> Stop
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="grid size-9 place-items-center rounded-full bg-gold-400 text-ink-950 disabled:opacity-40" aria-label="Send">
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </form>
      ) : (
        <Alert tone="info">Your role has read-only access to executive conversations.</Alert>
      )}
    </div>
  );
}

function MessageRow({ m, exec, others, canRate, isLastExec, streaming, conversationId, onRegenerate, onEdit, onContinue }: { m: UIMessage; exec: ExecLite; others: ExecLite[]; canRate: boolean; isLastExec: boolean; streaming: boolean; conversationId: string | null; onRegenerate: () => void; onEdit: () => void; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fwdOpen, setFwdOpen] = useState(false);
  const [fwdDone, setFwdDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (m.role === "user") {
    return (
      <div className="group flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-md border border-line-gold/60 bg-gold-400/[0.07] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
          {!streaming && (
            <div className="mt-1 flex justify-end opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <IconBtn label="Edit and resend" onClick={onEdit}><Pencil className="size-3.5" /></IconBtn>
            </div>
          )}
        </div>
      </div>
    );
  }

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(m.content.replace(/[#*_>|`-]/g, " ")));
  };
  const real = !m.id.startsWith("pending-") && !m.pending;

  return (
    <div className="flex gap-3">
      <ExecutiveAvatar src={exec.avatar_url} shortTitle={exec.short_title} accent={exec.accent} size={34} ring={false} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: exec.accent }}>{exec.title}</span>
          {m.simulated && <SimulatedBadge />}
          {m.model && !m.simulated && <span className="font-mono text-[10px] text-ivory-faint">{m.model}</span>}
        </div>
        {m.content ? <Markdown>{m.content}</Markdown> : <span className="inline-flex items-center gap-2 text-sm text-ivory-muted"><Loader2 className="size-3.5 animate-spin" /> Thinking through it from the {exec.short_title} seat…</span>}
        {real && !streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {canRate && <FeedbackButtons executiveId={exec.id} executiveTitle={exec.title} sourceType="CONVERSATION" sourceId={m.id} initial={m.rating ?? null} />}
            <IconBtn label={copied ? "Copied" : "Copy"} onClick={async () => { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</IconBtn>
            <IconBtn label="Read aloud" onClick={speak}><Volume2 className="size-3.5" /></IconBtn>
            {isLastExec && <IconBtn label="Regenerate" onClick={onRegenerate}><RotateCcw className="size-3.5" /></IconBtn>}
            {isLastExec && <IconBtn label="Continue" onClick={onContinue}><Play className="size-3.5" /></IconBtn>}
            <IconBtn label={saved === "saved" ? "Saved to Memory (proposed)" : "Save to C-Suite Memory"} onClick={() => { setSaved("saving"); start(async () => { const r = await saveMessageToMemoryAction(m.id); setSaved(r.ok ? "saved" : "error"); }); }}>
              {saved === "saved" ? <Check className="size-3.5 text-ok" /> : pending && saved === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <BookmarkPlus className="size-3.5" />}
            </IconBtn>
            <div className="relative">
              <IconBtn label="Forward to another executive" onClick={() => setFwdOpen((o) => !o)}><CornerUpRight className="size-3.5" /></IconBtn>
              {fwdOpen && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-line-strong bg-ink-900 p-1 shadow-2xl">
                  {others.map((o) => (
                    <button key={o.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => start(async () => { const r = await forwardToExecutivesAction({ messageId: m.id, executiveIds: [o.id] }); setFwdOpen(false); if (r.ok) setFwdDone(r.threadId!); })}>
                      <ExecutiveAvatar src={o.avatar_url} shortTitle={o.short_title} accent={o.accent} size={20} ring={false} /> {o.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {conversationId && (
              <form action={bringToSessionAction.bind(null, conversationId)}>
                <IconBtn label="Bring to C-Suite Session" type="submit"><Users className="size-3.5" /></IconBtn>
              </form>
            )}
            {fwdDone && <Link href={`/comms?thread=${fwdDone}`} className="ml-1 text-xs text-gold-300 underline-offset-2 hover:underline">Forwarded — view in Comms</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, children, onClick, type = "button" }: { label: string; children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} title={label} aria-label={label} className="grid size-7 place-items-center rounded-md text-ivory-faint transition hover:bg-white/5 hover:text-ivory">
      {children}
    </button>
  );
}
