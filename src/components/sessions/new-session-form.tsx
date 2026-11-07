"use client";

import { useActionState, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { createSessionAction } from "@/server/sessions/actions";
import { cn } from "@/lib/utils";
import type { ModeOption, RunnerExec } from "./session-runner";

export function NewSessionForm({ execs, modes, projects, files, defaults }: { execs: RunnerExec[]; modes: ModeOption[]; projects: { id: string; name: string }[]; files: { id: string; filename: string }[]; defaults: { objective?: string; with?: string } }) {
  const [state, action, pending] = useActionState(createSessionAction, {});
  const [selected, setSelected] = useState<string[]>(() => {
    const ceo = execs.find((e) => e.role_code === "CEO")?.id;
    const base = execs.filter((e) => ["CEO", "CFO", "CLO"].includes(e.role_code)).map((e) => e.id);
    return defaults.with ? [...new Set([ceo, defaults.with].filter(Boolean) as string[])] : base;
  });
  const [mode, setMode] = useState("CEO_SYNTHESIS");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {state.error && <Alert tone="risk">{state.error}</Alert>}
        <div className="plate space-y-5 p-6">
          <div>
            <Label htmlFor="title">Session title</Label>
            <Input id="title" name="title" required placeholder="e.g. Should we expand into the UK this year?" defaultValue={defaults.objective ? defaults.objective.slice(0, 120) : ""} />
          </div>
          <div>
            <Label htmlFor="objective">Objective — the business question</Label>
            <Textarea id="objective" name="objective" required rows={4} defaultValue={defaults.objective} placeholder="State the decision to be made, constraints and what a good outcome looks like." />
          </div>
        </div>

        <fieldset className="plate p-6">
          <legend className="sr-only">Select executives</legend>
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Select executives</p>
            <button type="button" className="text-xs text-gold-300" onClick={() => setSelected(selected.length === execs.length ? [] : execs.map((e) => e.id))}>{selected.length === execs.length ? "Clear" : "Convene all seven"}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {execs.map((e) => {
              const on = selected.includes(e.id);
              return (
                <button key={e.id} type="button" onClick={() => toggle(e.id)} aria-pressed={on} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", on ? "border-line-gold bg-gold-400/[0.06]" : "border-line hover:border-line-strong")}>
                  <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={36} ring={false} />
                  <span className="text-sm">{e.title}</span>
                  <span className={cn("ml-auto size-4 rounded-full border", on ? "border-gold-400 bg-gold-400" : "border-line-strong")} aria-hidden />
                </button>
              );
            })}
          </div>
          {selected.map((id) => <input key={id} type="hidden" name="participants" value={id} />)}
        </fieldset>
      </div>

      <aside className="space-y-6">
        <div className="plate space-y-4 p-6">
          <p className="eyebrow">Session strategy</p>
          <Select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Session mode">
            {modes.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}
          </Select>
          <p className="text-xs text-ivory-muted">{modes.find((m) => m.mode === mode)?.description}</p>
          <div>
            <Label htmlFor="chair">Chair</Label>
            <Select id="chair" name="chair" defaultValue={execs.find((e) => e.role_code === "CEO")?.id}>
              {execs.filter((e) => selected.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select id="project_id" name="project_id" defaultValue="">
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          {files.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-ivory-muted">Attach documents (max 5)</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm text-ivory-muted">
                    <input type="checkbox" name="attachments" value={f.id} className="accent-gold-400" /> <span className="truncate">{f.filename}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending || selected.length < 2}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />} Convene {selected.length} executives
        </Button>
      </aside>
    </form>
  );
}
