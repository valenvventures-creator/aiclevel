import Link from "next/link";
import { BookOpen, Brain, FileText, Files as FilesIcon, Library, Lock } from "lucide-react";
import { ActionForm } from "@/components/settings/action-form";
import { Badge, Card, Input, Label, SectionTitle, Select, Textarea } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { listLibrary } from "@/server/executives/library";
import { listCompanyFiles } from "@/server/files/service";
import { deleteLibraryItemAction, toggleLibraryItemAction, updateLibraryItemAction } from "@/server/executives/learning-actions";
import type { AIExecutive, ExecutiveLibraryItem } from "@/types/domain";

const KIND_LABEL: Record<ExecutiveLibraryItem["kind"], string> = { FRAMEWORK: "Framework", PLAYBOOK: "Playbook", REFERENCE: "Reference", DOCUMENT: "Document" };
const SHOWN_DOCUMENTS = 12;

/**
 * Executive Office → Library: what this executive draws on besides its own
 * knowledge (Learning tab) — the organization's shared company documents
 * (Files) and the built-in frameworks for its role.
 */
export async function LibraryTab({ orgId, exec, canConfigure, canUploadCompany }: { orgId: string; exec: Pick<AIExecutive, "id" | "slug" | "title" | "short_title" | "role_code">; canConfigure: boolean; canUploadCompany: boolean }) {
  const [items, files] = await Promise.all([listLibrary(orgId, exec), listCompanyFiles(orgId)]);
  const starters = items.filter((i) => i.origin === "STARTER");
  const readable = files.filter((f) => (f.extracted_text ?? "").trim());
  const unreadable = files.length - readable.length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="flex items-start gap-3">
            <Library className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
            <div>
              <p className="text-sm">Besides its own knowledge, the {exec.title} draws on what your organization shares with all seven executives: your company documents and proven frameworks for its role.</p>
              <p className="mt-1 text-xs text-ivory-muted">For each question it uses the few most relevant passages and cites them — [D1] for company documents, [L1] for frameworks and its own knowledge.</p>
            </div>
          </div>
        </Card>

        <section aria-labelledby="company-documents">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h2 id="company-documents" className="font-heading text-xl font-semibold">Company documents</h2>
            <Badge tone="neutral">Shared by all seven</Badge>
            <ButtonLink href="/files" size="sm" variant="ghost" className="ml-auto"><FilesIcon className="size-3.5" /> {canUploadCompany ? "Add or manage in Files" : "Open Files"}</ButtonLink>
          </div>
          <p className="mb-3 text-xs text-ivory-muted">Everything uploaded in Files, including the foundational documents added when your organization was set up. Every executive searches these for each question.</p>
          {readable.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ivory-muted">
              No company documents yet. Upload your plans, policies, pitch decks and financials in <Link href="/files" className="text-gold-300 underline-offset-2 hover:underline">Files</Link> — all seven executives will draw on them.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {readable.slice(0, SHOWN_DOCUMENTS).map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <FileText className="size-4 shrink-0 text-gold-300" aria-hidden />
                  <Link href={`/files#${f.id}`} className="min-w-0 truncate hover:text-gold-200">{f.filename}</Link>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-ivory-faint">{f.category.toUpperCase()} · {formatRelative(f.created_at).toUpperCase()}</span>
                </li>
              ))}
              {readable.length > SHOWN_DOCUMENTS && <li className="px-4 py-2.5 text-xs text-ivory-muted">…and {readable.length - SHOWN_DOCUMENTS} more in <Link href="/files" className="text-gold-300 underline-offset-2 hover:underline">Files</Link>.</li>}
            </ul>
          )}
          {unreadable > 0 && <p className="mt-2 text-xs text-ivory-faint">{unreadable} {unreadable === 1 ? "file has" : "files have"} no readable text (for example images or scanned PDFs), so executives cannot draw on {unreadable === 1 ? "it" : "them"}.</p>}
        </section>

        <section aria-labelledby="starter-knowledge">
          <h2 id="starter-knowledge" className="mb-1 font-heading text-xl font-semibold">Built-in frameworks</h2>
          <p className="mb-3 text-xs text-ivory-muted">General, well-established frameworks for the {exec.short_title} role. The executive adapts them to your organization. {canConfigure && "Turn off any you don't want used."}</p>
          <ul className="space-y-3">{starters.map((i) => <LibraryItemCard key={i.id} item={i} canConfigure={canConfigure} />)}</ul>
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <WhereKnowledgeGoes exec={exec} />
      </aside>
    </div>
  );
}

/** The three places knowledge can go, so people pick the right one. */
export function WhereKnowledgeGoes({ exec }: { exec: Pick<AIExecutive, "slug" | "short_title"> }) {
  const rows = [
    { icon: Lock, title: `Only the ${exec.short_title}`, body: "Documents, knowledge and lessons for this executive alone.", href: `/executives/${exec.slug}?tab=learning`, link: "Learning tab" },
    { icon: FilesIcon, title: "All seven executives", body: "Company documents: plans, policies, decks, financials.", href: "/files", link: "Files" },
    { icon: Brain, title: "Facts and decisions", body: "Verified organizational facts, decisions and commitments.", href: "/memory", link: "C-Level Memory" },
  ];
  return (
    <Card>
      <SectionTitle>Where knowledge goes</SectionTitle>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.title} className="flex gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line-gold/60 bg-gold-400/[0.06] text-gold-200"><r.icon className="size-4" aria-hidden /></span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{r.title}</span>
              <span className="block text-xs text-ivory-muted">{r.body}</span>
              <Link href={r.href} className="text-xs text-gold-300 underline-offset-2 hover:underline">{r.link} →</Link>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function LibraryItemCard({ item, canConfigure }: { item: ExecutiveLibraryItem; canConfigure: boolean }) {
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
