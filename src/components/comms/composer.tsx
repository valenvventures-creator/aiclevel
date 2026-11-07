"use client";

import { useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { sendCommunicationAction } from "@/server/comms/actions";
import { cn } from "@/lib/utils";

export interface ComposerExec { id: string; short_title: string; title: string; avatar_url: string | null; accent: string }
export interface ComposerMember { id: string; name: string }
export interface ComposerOrigin { type: string; id: string; label: string }

export function ExecutiveCommsComposer({ execs, members, defaults, origins }: { execs: ComposerExec[]; members: ComposerMember[]; defaults?: { to?: string[]; subject?: string; body?: string; thread_id?: string }; origins: ComposerOrigin[] }) {
  const [state, action, pending] = useActionState(sendCommunicationAction, {});
  const [to, setTo] = useState<string[]>(defaults?.to ?? []);
  const [origin, setOrigin] = useState("");
  const all = to.length === execs.length;
  const toggle = (id: string) => setTo((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const chosenOrigin = origins.find((o) => `${o.type}:${o.id}` === origin);

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {defaults?.thread_id && <input type="hidden" name="thread_id" value={defaults.thread_id} />}
      {to.map((id) => <input key={id} type="hidden" name="recipients" value={id} />)}
      {chosenOrigin && (
        <>
          <input type="hidden" name="origin_type" value={chosenOrigin.type} />
          <input type="hidden" name="origin_id" value={chosenOrigin.id} />
        </>
      )}
      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between text-xs font-medium text-ivory-muted">
          <span>To — A.I. Executives</span>
          <button type="button" onClick={() => setTo(all ? [] : execs.map((e) => e.id))} className="text-gold-300 hover:text-gold-200">{all ? "Clear" : "All seven"}</button>
        </legend>
        <div className="flex flex-wrap gap-2">
          {execs.map((e) => {
            const on = to.includes(e.id);
            return (
              <button key={e.id} type="button" onClick={() => toggle(e.id)} aria-pressed={on} className={cn("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition", on ? "border-line-gold bg-gold-400/10 text-ivory" : "border-line text-ivory-muted hover:border-line-strong")}>
                <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={22} ring={false} /> {e.short_title}
              </button>
            );
          })}
        </div>
      </fieldset>
      {members.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ivory-muted">Human team members</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = to.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={on} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-line-gold bg-gold-400/10" : "border-line text-ivory-muted")}>{m.name}</button>
              );
            })}
          </div>
        </fieldset>
      )}
      <div>
        <Label htmlFor="origin">Begin from</Label>
        <Select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">Blank message</option>
          {["REPORT", "SESSION", "MEMORY", "PROJECT", "FILE", "CONVERSATION", "TEMPLATE"].map((t) => {
            const opts = origins.filter((o) => o.type === t);
            return opts.length ? (
              <optgroup key={t} label={t.charAt(0) + t.slice(1).toLowerCase()}>
                {opts.map((o) => <option key={o.id} value={`${o.type}:${o.id}`}>{o.label}</option>)}
              </optgroup>
            ) : null;
          })}
        </Select>
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" defaultValue={defaults?.subject ?? chosenOrigin?.label ?? ""} key={chosenOrigin?.id} required />
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" rows={8} defaultValue={defaults?.body ?? (chosenOrigin ? `Regarding: ${chosenOrigin.label}\n\n` : "")} key={`b-${chosenOrigin?.id}`} required />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="submit" name="intent" value="draft" variant="ghost" disabled={pending}>Save draft</Button>
        <Button type="submit" name="intent" value="send" disabled={pending || to.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
        </Button>
      </div>
    </form>
  );
}
