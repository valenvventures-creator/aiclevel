"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ACTIVITY_LABEL } from "@/config/crm";
import { addActivityAction } from "@/server/crm/actions";

const KINDS = ["NOTE", "CALL", "MEETING", "TASK", "EMAIL"] as const;

/** Log a note, call, meeting, email, or schedule a task, on a contact or deal. */
export function ActivityForm({ contactId, dealId }: { contactId?: string | null; dealId?: string | null }) {
  const [state, action, pending] = useActionState(addActivityAction, {});
  const form = useRef<HTMLFormElement>(null);
  // The schedule field is local time; the server needs the offset to store it correctly.
  const [tzOffset] = useState(() => new Date().getTimezoneOffset());
  return (
    <form ref={form} action={action} className="space-y-3">
      {contactId && <input type="hidden" name="contact_id" value={contactId} />}
      {dealId && <input type="hidden" name="deal_id" value={dealId} />}
      <input type="hidden" name="tz_offset" value={tzOffset} />
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.ok && <Alert tone="ok">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <div>
          <Label htmlFor="a-kind">Type</Label>
          <Select id="a-kind" name="kind" defaultValue={state.values?.kind ?? "NOTE"}>{KINDS.map((k) => <option key={k} value={k}>{ACTIVITY_LABEL[k]}</option>)}</Select>
        </div>
        <div>
          <Label htmlFor="a-subject">Subject</Label>
          <Input id="a-subject" name="subject" required maxLength={200} defaultValue={state.values?.subject ?? ""} placeholder="e.g. Discovery call with the CFO" />
        </div>
      </div>
      <div>
        <Label htmlFor="a-details">Details</Label>
        <Textarea id="a-details" name="details" rows={3} maxLength={5000} defaultValue={state.values?.details ?? ""} placeholder="What was discussed, decided or agreed" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="a-due">Due / scheduled (tasks, calls, meetings)</Label>
          <Input id="a-due" name="due_at" type="datetime-local" defaultValue={state.values?.due_at ?? ""} />
        </div>
        <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Add activity</Button>
      </div>
    </form>
  );
}
