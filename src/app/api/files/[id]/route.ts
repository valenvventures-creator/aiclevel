import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { readFile } from "@/server/files/service";

/** Authorized download. Supabase mode redirects to a 60-second signed URL. */
export async function GET(_: Request, { params }: RouteContext<"/api/files/[id]">) {
  try {
    const ctx = await authorize("files.read");
    const { id } = await params;
    const rec = await db().files.get(ctx.organization.id, id);
    if (!rec) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const res = await readFile(rec);
    if (!res) return NextResponse.json({ error: "This file's contents are not available (demo seed metadata only)." }, { status: 404 });
    if ("signedUrl" in res) return NextResponse.redirect(res.signedUrl);
    return new NextResponse(Buffer.from(res.bytes), { headers: { "content-type": rec.mime_type, "content-disposition": `attachment; filename="${rec.filename.replace(/"/g, "")}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (err) {
    return apiError(err);
  }
}
