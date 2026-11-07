import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { slugify } from "@/lib/utils";

export async function GET(req: Request, { params }: RouteContext<"/api/studio/[id]/export">) {
  try {
    const ctx = await authorize("reports.read");
    const { id } = await params;
    const v = Number(new URL(req.url).searchParams.get("v") ?? "0");
    const job = await db().productionJobs.get(ctx.organization.id, id);
    if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const arts = await db().artifacts.list(ctx.organization.id, { where: { job_id: id }, orderBy: "version", desc: true });
    const art = arts.find((a) => a.version === v) ?? arts[0];
    if (!art) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const banner = art.simulated ? "<!-- Simulated demo content — not live A.I. output -->\n\n" : "";
    return new NextResponse(banner + art.content, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slugify(job.title) || "finished-work"}-v${art.version}.md"`, "cache-control": "private, no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
