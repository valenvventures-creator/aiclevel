import { BookOpen, FileText, Library } from "lucide-react";
import { ActionForm } from "@/components/settings/action-form";
import { Badge, Card, Input, Label, SectionTitle, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { LibraryUpload } from "./library-upload";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { listLibrary } from "@/server/executives/library";
import { addLibraryDocumentAction, addLibraryItemAction, deleteLibraryItemAction, toggleLibraryItemAction, updateLibraryItemAction } from "@/server/executives/learning-actions";
import type { AIExecutive, ExecutiveLibraryItem } from "@/types/domain";

const DOC_EXT = /\.(pdf|docx|pptx|xlsx|csv|txt|md)$/i;

const KIND_LABEL: Record<ExecutiveLibraryItem["kind"], string> = { FRAMEWORK: "Framework", PLAYBOOK: "Playbook", REFERENCE: "Reference", DOCUMENT: "Document" };

/** Executive Office → Library: the reference knowledge this executive draws on. */
export async function LibraryTab({ orgId, exec, canConfigure }: { orgId: string; exec: Pick<AIExecutive, "id" | "title" | "short_title" | "role_code">; canConfigure: boolean }) {
  const [items, files] = await Promise.all([listLibrary(orgId, exec), canConfigure ? db().files.list(orgId, { orderBy: "created_at", desc: true, limit: 100 }) : Promise.resolve([])]);
  const own = items.filter((i) => i.origin === "ORGANIZATION");
  const starters = items.filter((i) => i.origin === "STARTER");
  const inLibrary = new Set(items.map((i) => i.file_id).filter(Boolean));
  const documents = files.filter((f) => DOC_EXT.test(f.filename) && f.processing_status !== "FAILED" && !inLibrary.has(f.id));
  const active = items.filter((i) => i.enabled).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="flex items-start gap-3">
            <Library className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
            <div>
              <p className="text-sm">The {exec.title}&apos;s library is the reference knowledge it draws on: your organization&apos;s own playbooks and documents, plus proven frameworks for its field.</p>
              <p className="mt-1 text-xs text-ivory-muted">For each question, the few most relevant items are used (and cited as [L1], [L2]…). {active} of {items.length} items are turned on.</p>
            </div>
          </div>
        </Card>

        <section aria-labelledby="own-knowledge">
          <h2 id="own-knowledge" className="mb-3 font-heading text-xl font-semibold">Your organization&apos;s knowledge</h2>
          {own.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ivory-muted">
              Nothing added yet. {canConfigure ? `Add your own playbooks, policies and documents so the ${exec.short_title} works the way your organization does.` : "An admin can add your organization's playbooks and documents here."}
            </p>
          ) : (
            <ul className="space-y-3">{own.map((i) => <LibraryItemCard key={i.id} item={i} canConfigure={canConfigure} />)}</ul>
          )}
        </section>

        <section aria-labelledby="starter-knowledge">
          <h2 id="starter-knowledge" className="mb-1 font-heading text-xl font-semibold">Starter frameworks</h2>
          <p className="mb-3 text-xs text-ivory-muted">General, well-established frameworks for the {exec.short_title} role. The executive adapts them to your organization. {canConfigure && "Turn off any you don't want used."}</p>
          <ul className="space-y-3">{starters.map((i) => <LibraryItemCard key={i.id} item={i} canConfigure={canConfigure} />)}</ul>
        </section>
      </div>

      {canConfigure && (
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <SectionTitle>Upload documents</SectionTitle>
            <p className="mb-3 text-xs text-ivory-muted">Playbooks, policies, price lists, past reports, decks or spreadsheets. The text of each file is added to the {exec.short_title}&apos;s library (up to about 20,000 characters per file), and the file is kept in Files.</p>
            <LibraryUpload executiveId={exec.id} executiveShortTitle={exec.short_title} />
          </Card>
          <Card>
            <SectionTitle>Write it in</SectionTitle>
            <ActionForm action={addLibraryItemAction} submit="Add to library">
              <input type="hidden" name="executive_id" value={exec.id} />
              <div>
                <Label htmlFor="lib-kind">Type</Label>
                <Select id="lib-kind" name="kind" defaultValue="PLAYBOOK">
                  <option value="PLAYBOOK">Playbook: how we do something</option>
                  <option value="FRAMEWORK">Framework: a way of thinking</option>
                  <option value="REFERENCE">Reference: facts, figures, policies</option>
                </Select>
              </div>
              <div><Label htmlFor="lib-title">Title</Label><Input id="lib-title" name="title" required maxLength={160} placeholder="e.g. How we price enterprise deals" /></div>
              <div><Label htmlFor="lib-content">Content</Label><Textarea id="lib-content" name="content" required rows={7} placeholder="Write it the way you would brief a new senior hire: steps, rules of thumb, numbers, what to avoid." /></div>
            </ActionForm>
          </Card>
          {documents.length > 0 && (
            <Card>
              <SectionTitle>Or choose from Files</SectionTitle>
              <ActionForm action={addLibraryDocumentAction} submit="Add document">
                <input type="hidden" name="executive_id" value={exec.id} />
                <div>
                  <Label htmlFor="lib-file">Document already in Files</Label>
                  <Select id="lib-file" name="file_id" required>
                    {documents.map((f) => <option key={f.id} value={f.id}>{f.filename}</option>)}
                  </Select>
                </div>
              </ActionForm>
            </Card>
          )}
        </aside>
      )}
    </div>
  );
}

function LibraryItemCard({ item, canConfigure }: { item: ExecutiveLibraryItem; canConfigure: boolean }) {
  const editable = canConfigure && item.origin === "ORGANIZATION";
  return (
    <li className={item.enabled ? "rounded-2xl border border-line p-4" : "rounded-2xl border border-dashed border-line p-4 opacity-60"}>
      <div className="flex flex-wrap items-center gap-2">
        {item.kind === "DOCUMENT" ? <FileText className="size-4 text-gold-300" aria-hidden /> : <BookOpen className="size-4 text-gold-300" aria-hidden />}
        <span className="text-sm font-medium">{item.title}</span>
        <Badge tone="neutral">{KIND_LABEL[item.kind]}</Badge>
        {!item.enabled && <Badge tone="warn">Off</Badge>}
        <span className="ml-auto font-mono text-[10px] text-ivory-faint">{item.origin === "STARTER" ? "STARTER" : `UPDATED ${formatRelative(item.updated_at).toUpperCase()}`}</span>
      </div>
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs text-gold-300 hover:text-gold-200">Read</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ivory-muted">{item.content.length > 4000 ? `${item.content.slice(0, 4000)}…` : item.content}</p>
      </details>
      {canConfigure && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={toggleLibraryItemAction}><input type="hidden" name="id" value={item.id} /><Button size="sm" variant="outline">{item.enabled ? "Turn off" : "Turn on"}</Button></form>
          {editable && (
            <form action={deleteLibraryItemAction}><input type="hidden" name="id" value={item.id} /><Button size="sm" variant="ghost">Delete</Button></form>
          )}
        </div>
      )}
      {editable && (
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-xs text-ivory-muted hover:text-ivory">Edit</summary>
          <ActionForm action={updateLibraryItemAction} submit="Save changes" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={item.id} />
            {item.kind !== "DOCUMENT" && (
              <div>
                <Label htmlFor={`k-${item.id}`}>Type</Label>
                <Select id={`k-${item.id}`} name="kind" defaultValue={item.kind}>
                  <option value="PLAYBOOK">Playbook</option>
                  <option value="FRAMEWORK">Framework</option>
                  <option value="REFERENCE">Reference</option>
                </Select>
              </div>
            )}
            <div><Label htmlFor={`t-${item.id}`}>Title</Label><Input id={`t-${item.id}`} name="title" defaultValue={item.title} required maxLength={160} /></div>
            <div><Label htmlFor={`c-${item.id}`}>Content</Label><Textarea id={`c-${item.id}`} name="content" defaultValue={item.content} rows={8} required /></div>
          </ActionForm>
        </details>
      )}
    </li>
  );
}
