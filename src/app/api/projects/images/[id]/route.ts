import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { readFile } from "@/server/files/service";

/** Serves a project cover image to members of its organization. */
export async function GET(_req: Request, { params }: RouteContext<"/api/projects/images/[id]">) {
  try {
    const ctx = await authorize("projects.read");
    const { id } = await params;
    const rec = await db().files.get(ctx.organization.id, id);
    if (!rec || rec.purpose !== "PROJECT_IMAGE") return NextResponse.json({ error: "Not found." }, { status: 404 });
    const stored = await readFile(rec);
    if (!stored) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if ("signedUrl" in stored) return NextResponse.redirect(stored.signedUrl, 302);
    // Each upload has its own id, so the bytes behind this URL never change.
    return new Response(new Blob([new Uint8Array(stored.bytes)]), { headers: { "content-type": rec.mime_type, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch (err) {
    return apiError(err);
  }
}
