import type { Metadata } from "next";
import { Download, FileText, Files as FilesIcon, Image as ImageIcon, Sheet } from "lucide-react";
import { FileUploader } from "@/components/files/file-uploader";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { formatBytes, formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";
import { deleteFileAction } from "@/server/files/actions";

export const metadata: Metadata = { title: "Files" };

const icon = (mime: string) => (mime.startsWith("image/") ? ImageIcon : mime.includes("sheet") || mime.includes("csv") ? Sheet : FileText);

export default async function FilesPage() {
  const ctx = await requireContext();
  const files = await db().files.list(ctx.organization.id, { orderBy: "created_at", desc: true });
  const canDelete = can(ctx.role, "files.delete");
  return (
    <div>
      <PageHeader eyebrow="Files" title="Organizational document library" description="Private to your organization. Downloads are authorized per request — never permanent public links. Text from documents becomes searchable by your executives." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {files.length === 0 ? (
            <EmptyState icon={<FilesIcon className="size-5" />} title="No files yet." body="Upload business plans, financials, policies and brand guidelines." />
          ) : (
            <ul className="surface divide-y divide-line p-0">
              {files.map((f) => {
                const I = icon(f.mime_type);
                return (
                  <li key={f.id} id={f.id} className="flex items-center gap-4 px-4 py-3 target:bg-gold-400/[0.05]">
                    <I className="size-5 shrink-0 text-gold-300" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.filename}</p>
                      <p className="font-mono text-[10px] text-ivory-faint">{f.category} · {formatBytes(f.size)} · {formatRelative(f.created_at)}</p>
                    </div>
                    <Badge tone={f.processing_status === "READY" ? "ok" : f.processing_status === "FAILED" ? "risk" : "warn"}>{f.processing_status === "PENDING" ? "Awaiting extraction" : f.processing_status}</Badge>
                    <a href={`/api/files/${f.id}`} className="grid size-8 place-items-center rounded-lg text-ivory-muted hover:bg-white/5 hover:text-ivory" aria-label={`Download ${f.filename}`}><Download className="size-4" /></a>
                    {canDelete && (
                      <form action={deleteFileAction}><input type="hidden" name="id" value={f.id} /><button className="text-xs text-ivory-faint hover:text-risk" aria-label={`Delete ${f.filename}`}>Delete</button></form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {can(ctx.role, "files.upload") && (
          <Card className="self-start">
            <SectionTitle>Upload</SectionTitle>
            <FileUploader />
            <p className="mt-3 text-xs text-ivory-faint">Uploaded content is treated as untrusted data: it informs executives but can never override platform rules or permissions.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
