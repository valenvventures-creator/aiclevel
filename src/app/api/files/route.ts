import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { MAX_UPLOAD_BYTES, storeFile, UploadError } from "@/server/files/service";

export async function POST(req: Request) {
  try {
    const ctx = await authorize("files.upload");
    if (!rateLimit(`upload:${ctx.user.id}`, 30, 60 * 60_000).ok) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_UPLOAD_BYTES + 1024 * 64) return NextResponse.json({ error: "Files must be 20 MB or smaller." }, { status: 413 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const projectId = typeof form.get("project_id") === "string" && form.get("project_id") ? String(form.get("project_id")) : null;
    const rec = await storeFile({ organization: ctx.organization, userId: ctx.user.id, filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), projectId });
    return NextResponse.json({ id: rec.id, filename: rec.filename, processing_status: rec.processing_status });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    return apiError(err);
  }
}
