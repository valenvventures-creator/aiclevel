"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { upsertMemoryAction } from "@/server/memory/actions";
import { EXECUTIVE_ROLE_CODES, MEMORY_CATEGORIES, type MemoryRecord } from "@/types/domain";

export function MemoryForm({ record, projects, canOwnerOnly }: { record?: MemoryRecord; projects: { id: string; name: string }[]; canOwnerOnly: boolean }) {
  const [state, action, pending] = useActionState(upsertMemoryAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !record) ref.current?.reset();
  }, [state, record]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.ok && <Alert tone="ok">Saved to C-Suite Memory.</Alert>}
      {record && <input type="hidden" name="id" value={record.id} />}
      <div>
        <Label htmlFor="m-title">Title</Label>
        <Input id="m-title" name="title" defaultValue={record?.title} required />
      </div>
      <div>
        <Label htmlFor="m-content">Content</Label>
        <Textarea id="m-content" name="content" defaultValue={record?.content} rows={4} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="m-cat">Category</Label>
          <Select id="m-cat" name="category" defaultValue={record?.category ?? "COMPANY"}>
            {MEMORY_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="m-imp">Importance</Label>
          <Select id="m-imp" name="importance" defaultValue={String(record?.importance ?? 3)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} — {["Low", "Minor", "Normal", "High", "Critical"][n - 1]}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="m-vis">Visibility</Label>
          <Select id="m-vis" name="visibility" defaultValue={record?.visibility ?? "ORGANIZATION"}>
            <option value="ORGANIZATION">Organization</option>
            <option value="LEADERSHIP">Leadership only</option>
            {canOwnerOnly && <option value="OWNER_ONLY">Owner only</option>}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="m-proj">Project</Label>
        <Select id="m-proj" name="project_id" defaultValue={record?.project_id ?? ""}>
          <option value="">None</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-ivory-muted">Most relevant to</legend>
        <div className="flex flex-wrap gap-2">
          {EXECUTIVE_ROLE_CODES.map((r) => (
            <label key={r} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
              <input type="checkbox" name="executive_relevance" value={r} defaultChecked={record?.executive_relevance.includes(r)} className="accent-gold-400" /> {r}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {record ? "Save changes" : "Add to Memory"}</Button>
    </form>
  );
}
