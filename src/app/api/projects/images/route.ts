import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { storeFile, UploadError } from "@/server/files/service";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/** Upload a project cover image (PNG, JPG or WebP, up to 8 MB). Not listed in Files. */
export async function POST(req: Request) {
  try {
    const ctx = await authorize("projects.manage");
    if (!rateLimit(`project-image:${ctx.user.id}`, 40, 60 * 60_000).ok) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (!IMAGE_EXT.test(file.name)) return NextResponse.json({ error: "Use a PNG, JPG or WebP image." }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });
    const rec = await storeFile({ organization: ctx.organization, userId: ctx.user.id, filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), purpose: "PROJECT_IMAGE" });
    return NextResponse.json({ id: rec.id, url: `/api/projects/images/${rec.id}` });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    return apiError(err);
  }
}
