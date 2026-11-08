"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Button } from "@/components/ui/button";
import { Alert, Select } from "@/components/ui/primitives";
import { previewRouteAction, submitStudioRequestAction } from "@/server/studio/actions";

interface ExecLite { role_code: string; title: string; short_title: string; avatar_url: string | null; accent: string }
type Preview = Awaited<ReturnType<typeof previewRouteAction>>;

const EXAMPLES = [
  "Create a three-year financial model.",
  "Build our investor presentation.",
  "Develop a fundraising strategy.",
  "Create our marketing campaign.",
  "Draft an HR policy.",
  "Research this technology.",
  "Analyze this contract.",
  "Create our sustainability report.",
];

export function StudioRequest({ execs, capabilities, projects, defaultLead }: { execs: ExecLite[]; capabilities: { key: string; label: string; lead: string }[]; projects: { id: string; name: string }[]; defaultLead?: string }) {
  const [state, action, pending] = useActionState(submitStudioRequestAction, {});
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [override, setOverride] = useState(() => (defaultLead ? (capabilities.find((c) => c.lead === defaultLead)?.key ?? "") : ""));
  const [, startTransition] = useTransition();
  const byRole = new Map(execs.map((e) => [e.role_code, e]));

  useEffect(() => {
    if (text.trim().length < 8) return;
    const id = setTimeout(() => startTransition(async () => setPreview(await previewRouteAction(text))), 300);
    return () => clearTimeout(id);
  }, [text]);

  const livePreview = text.trim().length < 8 ? null : preview;
  const chosen = override ? capabilities.find((c) => c.key === override) : livePreview ? { key: livePreview.key, label: livePreview.label, lead: livePreview.lead } : null;
  const lead = chosen ? byRole.get(chosen.lead) : undefined;

  return (
    <form action={action} className="plate relative overflow-hidden p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-gold-400/10 blur-3xl" />
      <p className="eyebrow relative">C-Level Studio</p>
      <h2 className="relative mt-2 font-heading text-3xl font-semibold">Tell your C-Level what you need.</h2>
      <p className="relative mt-1 text-sm text-ivory-muted">The right executive leads the work.</p>
      {state.error && <div className="relative mt-4"><Alert tone="risk">{state.error}</Alert></div>}
      <label htmlFor="studio-req" className="sr-only">Describe the work you need</label>
      <textarea id="studio-req" name="request" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. Build our investor presentation for the seed extension, emphasizing Enterprise traction." className="relative mt-5 w-full rounded-2xl border border-line-strong bg-ink-950/60 p-4 text-base outline-none placeholder:text-ivory-faint focus:border-gold-500" />
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => <button type="button" key={ex} onClick={() => setText(ex)} className="rounded-full border border-line px-3 py-1 text-xs text-ivory-muted hover:border-line-gold hover:text-ivory">{ex}</button>)}
      </div>

      <div className="relative mt-6 grid gap-4 rounded-2xl border border-line bg-white/[0.015] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-3" aria-live="polite">
          {lead ? (
            <>
              <ExecutiveAvatar src={lead.avatar_url} shortTitle={lead.short_title} accent={lead.accent} size={44} />
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-ivory-faint">ROUTED TO THE RIGHT EXECUTIVE</p>
                <p className="text-sm"><span style={{ color: lead.accent }} className="font-semibold">{lead.title}</span> leads <span className="text-gold-200">{chosen?.label}</span></p>
                {livePreview && !override && livePreview.contributors.length > 0 && <p className="text-xs text-ivory-muted">With {livePreview.contributors.join(", ")}</p>}
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ivory-muted"><Sparkles className="size-4 text-gold-300" /> Describe the work and we&apos;ll route it to the right executive.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cap" className="sr-only">Route to</label>
          <Select id="cap" name="capability_key" value={override} onChange={(e) => setOverride(e.target.value)} className="h-10 w-56 text-xs">
            <option value="">Automatic routing</option>
            {capabilities.map((c) => <option key={c.key} value={c.key}>{c.label} — {c.lead}</option>)}
          </Select>
          <Select name="priority" defaultValue="NORMAL" aria-label="Priority" className="h-10 w-28 text-xs">
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </Select>
          {projects.length > 0 && (
            <Select name="project_id" defaultValue="" aria-label="Project" className="h-10 w-40 text-xs">
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </div>
      </div>
      <div className="relative mt-5 flex justify-end">
        <Button type="submit" size="lg" disabled={pending || text.trim().length < 8}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Assign to the C-Level <ArrowRight className="size-4" /></Button>
      </div>
    </form>
  );
}
