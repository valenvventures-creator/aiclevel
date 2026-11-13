import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { addLibraryItem, LIBRARY_LIMITS } from "@/server/executives/library";
import { canExtract } from "@/server/files/extract";
import { deleteFile, MAX_UPLOAD_BYTES, storeFile, UploadError } from "@/server/files/service";
import { audit } from "@/server/audit";

/**
 * Upload a document for ONE executive (its Learning tab). The file is private
 * to that executive: its text joins that executive's own library, it is not
 * listed in Files and it is not added to C-Level Memory. Company-wide
 * documents are uploaded in Files instead, where every executive draws on them.
 */
export async function POST(req: Request, { params }: RouteContext<"/api/executives/[slug]/documents">) {
  try {
    const ctx = await authorize("executives.configure");
    const { slug } = await params;
    if (!rateLimit(`exec-upload:${ctx.user.id}`, 60, 60 * 60_000).ok) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
    const exec = await AIExecutiveRegistry.getExecutive(ctx.organization.id, slug);
    if (!exec) return NextResponse.json({ error: "Executive not found." }, { status: 404 });

    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_UPLOAD_BYTES + 1024 * 64) return NextResponse.json({ error: "Files must be 20 MB or smaller." }, { status: 413 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!canExtract(ext)) return NextResponse.json({ error: "Use a PDF, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), CSV, TXT or Markdown file." }, { status: 400 });

    const rec = await storeFile({ organization: ctx.organization, userId: ctx.user.id, filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), executiveId: exec.id });
    const text = (rec.extracted_text ?? "").trim();
    if (!text) {
      await deleteFile(rec);
      const scan = ext === "pdf" ? " — it is probably a scan or a picture of pages. Upload a PDF with selectable text, or a Word, PowerPoint, Excel or text version" : "";
      return NextResponse.json({ error: `“${rec.filename}” has no readable text${scan}.` }, { status: 422 });
    }
    const item = await addLibraryItem(ctx.organization.id, ctx.user.id, exec.id, { kind: "DOCUMENT", title: rec.filename, content: text.slice(0, LIBRARY_LIMITS.DOCUMENT_CHARS), fileId: rec.id });
    await audit(ctx.organization.id, ctx.user.id, "executive.library", "executive_library_item", item.id, { action: "upload_private_document", file_id: rec.id, executive_id: exec.id });
    revalidatePath(`/executives/${exec.slug}`);
    const long = text.length > LIBRARY_LIMITS.DOCUMENT_CHARS ? " (the first part of a long document)" : "";
    return NextResponse.json({ ok: true, message: `Added for the ${exec.short_title} only${long}.` });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    return apiError(err);
  }
}
